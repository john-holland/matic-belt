#!/usr/bin/env python3
"""
JSON stdin/stdout sidecar for quantum_geo simulation math.
All outputs are illustrative / simulation-only (not physical predictions).
"""
from __future__ import annotations

import json
import math
import sys
from typing import Any, Dict, List, Tuple

import numpy as np
from scipy.optimize import nnls

G_EARTH = 9.80665
R_SPECIFIC_DRY_AIR = 287.05  # J/(kg*K)

# WGS84-like / spherical bodies (m)
BODY_A = {
    "earth": 6378137.0,
    "mars": 3396190.0,
    "custom": None,
}


def llh_to_ecef(lat_deg: float, lon_deg: float, alt_m: float, body: str, planet_radius_m: float | None) -> np.ndarray:
    a = float(planet_radius_m or BODY_A.get(body) or BODY_A["earth"])
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    n = a + alt_m
    x = n * math.cos(lat) * math.cos(lon)
    y = n * math.cos(lat) * math.sin(lon)
    z = n * math.sin(lat)
    return np.array([x, y, z], dtype=np.float64)


def enu_to_ecef_rotation(lat_deg: float, lon_deg: float) -> np.ndarray:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    sl, cl = math.sin(lat), math.cos(lat)
    so, co = math.sin(lon), math.cos(lon)
    # East, North, Up columns in ECEF
    e = np.array([-so, co, 0.0])
    n = np.array([-sl * co, -sl * so, cl])
    u = np.array([cl * co, cl * so, sl])
    return np.column_stack([e, n, u])


def ecef_from_llh_with_offset(
    lat_deg: float, lon_deg: float, alt_m: float, body: str, planet_radius_m: float | None, offset_enu_m: Dict[str, float]
) -> np.ndarray:
    base = llh_to_ecef(lat_deg, lon_deg, alt_m, body, planet_radius_m)
    R = enu_to_ecef_rotation(lat_deg, lon_deg)
    d = np.array(
        [offset_enu_m.get("east_m", 0.0), offset_enu_m.get("north_m", 0.0), offset_enu_m.get("up_m", 0.0)],
        dtype=np.float64,
    )
    return base + R @ d


def pressure_barometric(
    alt_m: float, surface_pressure_pa: float, scale_height_m: float
) -> float:
    return float(surface_pressure_pa * math.exp(-alt_m / max(scale_height_m, 1.0)))


def scale_height_h(T_k: float, g: float, m_air: float = 0.029) -> float:
    """Approx isothermal scale height H = R_specific * T / g for ideal gas."""
    return float(R_SPECIFIC_DRY_AIR * T_k / max(g, 0.01))


def toy_tunneling(
    pressure_pa: float,
    barrier_height_ev: float,
    particle_energy_ev: float,
    field_uniformity: float,
) -> Dict[str, float]:
    """Dimensionless toy barrier penetration (not WKB-accurate)."""
    ratio = max(0.0, (particle_energy_ev - barrier_height_ev) / max(barrier_height_ev, 1e-9))
    p_atm = pressure_pa / 101325.0
    tunneling = float(1.0 / (1.0 + math.exp(-4.0 * ratio)) * (0.5 + 0.5 * field_uniformity) * (0.7 + 0.15 * min(p_atm, 2.0)))
    effective_barrier = float(barrier_height_ev * (1.0 + 0.1 * math.log1p(p_atm)))
    return {
        "tunnelingProbability": min(1.0, max(0.0, tunneling)),
        "effectiveBarrier_eV": effective_barrier,
        "fieldUniformityScore": float(max(0.0, min(1.0, field_uniformity))),
    }


def op_mixture_nnls(payload: Dict[str, Any]) -> Dict[str, Any]:
    materials: Dict[str, Dict[str, float]] = payload["materials"]
    target_elements: List[str] = payload["targetElements"]
    target_fractions: List[float] = payload["targetFractions"]
    elem_index = {e: i for i, e in enumerate(target_elements)}
    mnames = list(materials.keys())
    n = len(mnames)
    k = len(target_elements)
    A = np.zeros((k, n), dtype=np.float64)
    for j, name in enumerate(mnames):
        vec = materials[name]
        for el, frac in vec.items():
            if el in elem_index:
                A[elem_index[el], j] = frac
    b = np.array(target_fractions, dtype=np.float64)
    b = b / max(np.linalg.norm(b), 1e-12)
    x, residual = nnls(A, b)
    pred = A @ x
    err = float(np.linalg.norm(pred - b))
    mix = [{"material": mnames[i], "fraction": float(x[i])} for i in range(n) if x[i] > 1e-6]
    return {"recommendedMix": mix, "spectralResidual": err, "predictedVector": pred.tolist()}


def op_nutrient_delta(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Linear nutrient delta scaled by tunneling probability (simulation)."""
    current = np.array(payload["currentNPK"], dtype=np.float64)
    desired = np.array(payload["desiredNPK"], dtype=np.float64)
    tprob = float(payload.get("tunnelingProbability", 0.5))
    delta = (desired - current) * tprob
    return {
        "deltaNPK": delta.tolist(),
        "quantumFieldAdjustment": float(0.5 + 0.5 * tprob),
    }


def op_containment(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Check ECEF point inside axis-aligned box in ECEF (approx for small volumes)."""
    p = np.array(payload["pointEcef_m"], dtype=np.float64)
    mn = np.array(payload["boxMinEcef_m"], dtype=np.float64)
    mx = np.array(payload["boxMaxEcef_m"], dtype=np.float64)
    inside = bool(np.all(p >= mn) and np.all(p <= mx))
    return {"contained": inside}


def op_distance_m(payload: Dict[str, Any]) -> Dict[str, Any]:
    a = np.array(payload["ecef_a_m"], dtype=np.float64)
    b = np.array(payload["ecef_b_m"], dtype=np.float64)
    return {"distance_m": float(np.linalg.norm(a - b))}


def op_ecef_box_from_local(payload: Dict[str, Any]) -> Dict[str, Any]:
    """8 corners of ENU-aligned box at lat/lon, return AABB in ECEF (approx containment)."""
    lat = float(payload["lat"])
    lon = float(payload["lon"])
    alt = float(payload["alt_m"])
    body = payload.get("body", "earth")
    pr = payload.get("planetRadius_m")
    base = llh_to_ecef(lat, lon, alt, body, pr)
    R = enu_to_ecef_rotation(lat, lon)
    mn = np.array(
        [
            float(payload["localMin_m"]["east_m"]),
            float(payload["localMin_m"]["north_m"]),
            float(payload["localMin_m"]["up_m"]),
        ],
        dtype=np.float64,
    )
    mx = np.array(
        [
            float(payload["localMax_m"]["east_m"]),
            float(payload["localMax_m"]["north_m"]),
            float(payload["localMax_m"]["up_m"]),
        ],
        dtype=np.float64,
    )
    corners = []
    for ea in (mn[0], mx[0]):
        for no in (mn[1], mx[1]):
            for up in (mn[2], mx[2]):
                corners.append(base + R @ np.array([ea, no, up], dtype=np.float64))
    arr = np.stack(corners, axis=0)
    bb_min = arr.min(axis=0)
    bb_max = arr.max(axis=0)
    return {
        "cornersEcef_m": [c.tolist() for c in corners],
        "aabbMinEcef_m": bb_min.tolist(),
        "aabbMaxEcef_m": bb_max.tolist(),
    }


def op_aabb_contains(payload: Dict[str, Any]) -> Dict[str, Any]:
    inner_min = np.array(payload["innerMinEcef_m"], dtype=np.float64)
    inner_max = np.array(payload["innerMaxEcef_m"], dtype=np.float64)
    outer_min = np.array(payload["outerMinEcef_m"], dtype=np.float64)
    outer_max = np.array(payload["outerMaxEcef_m"], dtype=np.float64)
    contained = bool(
        np.all(inner_min >= outer_min - 1e-6) and np.all(inner_max <= outer_max + 1e-6)
    )
    return {"contained": contained}


def handle(req: Dict[str, Any]) -> Dict[str, Any]:
    op = req.get("op")
    if op == "ecef_llh":
        body = req.get("body", "earth")
        r = llh_to_ecef(
            float(req["lat"]),
            float(req["lon"]),
            float(req["alt_m"]),
            body,
            req.get("planetRadius_m"),
        )
        return {"ecef_m": r.tolist()}
    if op == "ecef_with_offset":
        r = ecef_from_llh_with_offset(
            float(req["lat"]),
            float(req["lon"]),
            float(req["alt_m"]),
            req.get("body", "earth"),
            req.get("planetRadius_m"),
            req.get("offsetEnu_m", {}),
        )
        return {"ecef_m": r.tolist()}
    if op == "pressure_altitude":
        alt = float(req["alt_m"])
        T = float(req.get("temperature_K", 288.15))
        g = float(req.get("gravity_m_s2", G_EARTH))
        surf_p = float(req.get("surfacePressure_Pa", 101325.0))
        H = scale_height_h(T, g)
        p = pressure_barometric(alt, surf_p, H)
        return {"pressure_Pa": p, "scaleHeight_m": H}
    if op == "tunneling_toy":
        alt = float(req["alt_m"])
        T = float(req.get("temperature_K", 288.15))
        g = float(req.get("gravity_m_s2", G_EARTH))
        surf_p = float(req.get("surfacePressure_Pa", 101325.0))
        H = scale_height_h(T, g)
        p = pressure_barometric(alt, surf_p, H)
        tun = toy_tunneling(
            p,
            float(req.get("barrierHeight_eV", 2.0)),
            float(req.get("particleEnergy_eV", 1.5)),
            float(req.get("fieldUniformity", 0.85)),
        )
        tun["pressure_Pa"] = p
        return tun
    if op == "mixture_nnls":
        return op_mixture_nnls(req)
    if op == "nutrient_delta":
        return op_nutrient_delta(req)
    if op == "containment":
        return op_containment(req)
    if op == "distance_m":
        return op_distance_m(req)
    if op == "ecef_box_from_local":
        return op_ecef_box_from_local(req)
    if op == "aabb_contains":
        return op_aabb_contains(req)
    raise ValueError(f"unknown op: {op}")


def main() -> None:
    try:
        req = json.load(sys.stdin)
        out = handle(req)
        json.dump({"ok": True, "result": out}, sys.stdout)
    except Exception as e:  # noqa: BLE001 — surface errors to Node
        json.dump({"ok": False, "error": str(e)}, sys.stdout)


if __name__ == "__main__":
    main()
