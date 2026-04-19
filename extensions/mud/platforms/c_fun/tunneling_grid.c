/**
 * Optional numeric kernel: sample a toy tunneling score on a 1D grid of altitudes (m).
 * Build: make tunneling_grid
 * Usage: echo '{"baseAlt_m":0,"step_m":2,"numSamples":5,"scaleHeight_m":8500,"surfacePressure_Pa":101325}' | ./tunneling_grid
 */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int read_all_stdin(char **out, size_t *len) {
    size_t cap = 4096;
    *len = 0;
    *out = malloc(cap);
    if (!*out) return -1;
    for (;;) {
        size_t n = fread(*out + *len, 1, cap - *len - 1, stdin);
        *len += n;
        if (n == 0) break;
        if (*len + 1 >= cap) {
            cap *= 2;
            char *nbuf = realloc(*out, cap);
            if (!nbuf) {
                free(*out);
                return -1;
            }
            *out = nbuf;
        }
    }
    (*out)[*len] = '\0';
    return 0;
}

static double parse_json_number(const char *key, const char *json) {
    char pat[128];
    snprintf(pat, sizeof(pat), "\"%s\":", key);
    const char *p = strstr(json, pat);
    if (!p) return NAN;
    p += strlen(pat);
    while (*p == ' ' || *p == '\t') p++;
    return strtod(p, NULL);
}

int main(void) {
    char *buf = NULL;
    size_t len = 0;
    if (read_all_stdin(&buf, &len) || !buf) {
        fputs("{\"ok\":false,\"error\":\"stdin\"}\n", stdout);
        return 1;
    }
    double base = parse_json_number("baseAlt_m", buf);
    double step = parse_json_number("step_m", buf);
    double nraw = parse_json_number("numSamples", buf);
    double H = parse_json_number("scaleHeight_m", buf);
    double p0 = parse_json_number("surfacePressure_Pa", buf);
    if (isnan(base)) base = 0;
    if (isnan(step)) step = 1;
    if (isnan(H)) H = 8500;
    if (isnan(p0)) p0 = 101325;
    int ni = 8;
    if (!isnan(nraw)) {
        long nl = lround(nraw);
        if (nl < 1) nl = 1;
        if (nl > 256) nl = 256;
        ni = (int)nl;
    }
    printf("{\"ok\":true,\"samples\":[");
    for (int i = 0; i < ni; i++) {
        double alt = base + i * step;
        double p = p0 * exp(-alt / H);
        double score = 1.0 / (1.0 + exp(-0.0001 * (p - 50000)));
        if (i) printf(",");
        printf("{\"alt_m\":%.6f,\"pressure_Pa\":%.6f,\"score\":%.6f}", alt, p, score);
    }
    printf("]}\n");
    free(buf);
    return 0;
}
