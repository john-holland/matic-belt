import time
from typing import Optional, Dict, Any, List
import logging
import cv2
import numpy as np
from datetime import datetime
import threading
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class MovementType(Enum):
    NONE = "none"
    RUNNING = "running"
    FALL = "fall"
    WALKING = "walking"

@dataclass
class CameraSettings:
    timer_interval: float = 60.0  # seconds between timer-based captures
    movement_threshold: float = 30.0  # threshold for movement detection
    fall_threshold: float = 50.0  # threshold for fall detection
    running_threshold: float = 40.0  # threshold for running detection
    save_directory: str = "captures"
    resolution: tuple = (640, 480)
    fps: int = 30

class BeltTracking:
    def __init__(self, camera_settings: Optional[CameraSettings] = None):
        self._last_open_time: Optional[float] = None
        self._last_close_time: Optional[float] = None
        self._is_open: bool = False
        self._open_duration: float = 0.0
        self._total_opens: int = 0
        
        # Camera related attributes
        self._camera_settings = camera_settings or CameraSettings()
        self._camera: Optional[cv2.VideoCapture] = None
        self._timer_thread: Optional[threading.Thread] = None
        self._is_capturing: bool = False
        self._last_frame: Optional[np.ndarray] = None
        self._movement_history: List[Dict[str, Any]] = []
        self._capture_count: int = 0

    def start_camera(self) -> Dict[str, Any]:
        """
        Initialize and start the camera with the specified settings.
        """
        try:
            self._camera = cv2.VideoCapture(0)
            self._camera.set(cv2.CAP_PROP_FRAME_WIDTH, self._camera_settings.resolution[0])
            self._camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self._camera_settings.resolution[1])
            self._camera.set(cv2.CAP_PROP_FPS, self._camera_settings.fps)
            
            if not self._camera.isOpened():
                raise RuntimeError("Failed to open camera")
            
            self._is_capturing = True
            self._start_timer_capture()
            
            return {
                "status": "success",
                "message": "Camera started successfully",
                "settings": self._camera_settings.__dict__
            }
        except Exception as e:
            logger.error(f"Failed to start camera: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def stop_camera(self) -> Dict[str, Any]:
        """
        Stop the camera and cleanup resources.
        """
        self._is_capturing = False
        if self._camera is not None:
            self._camera.release()
            self._camera = None
        
        return {
            "status": "success",
            "message": "Camera stopped successfully"
        }

    def _start_timer_capture(self):
        """
        Start the timer-based capture thread.
        """
        def timer_capture():
            while self._is_capturing:
                self.capture_image("timer")
                time.sleep(self._camera_settings.timer_interval)
        
        self._timer_thread = threading.Thread(target=timer_capture, daemon=True)
        self._timer_thread.start()

    def capture_image(self, trigger: str = "manual") -> Dict[str, Any]:
        """
        Capture an image and detect movement.
        """
        if self._camera is None or not self._is_capturing:
            return {
                "status": "error",
                "message": "Camera not initialized or not capturing"
            }

        ret, frame = self._camera.read()
        if not ret:
            return {
                "status": "error",
                "message": "Failed to capture frame"
            }

        movement_data = self._detect_movement(frame)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self._camera_settings.save_directory}/capture_{timestamp}_{trigger}.jpg"
        
        cv2.imwrite(filename, frame)
        self._capture_count += 1
        
        return {
            "status": "success",
            "filename": filename,
            "movement": movement_data,
            "trigger": trigger,
            "timestamp": timestamp
        }

    def _detect_movement(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Detect movement type in the frame.
        """
        if self._last_frame is None:
            self._last_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return {"type": MovementType.NONE.value, "confidence": 0.0}

        # Convert current frame to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Calculate absolute difference between frames
        frame_diff = cv2.absdiff(self._last_frame, gray)
        movement = np.mean(frame_diff)
        
        # Update last frame
        self._last_frame = gray
        
        # Determine movement type based on thresholds
        movement_type = MovementType.NONE
        confidence = min(movement / self._camera_settings.movement_threshold, 1.0)
        
        if movement > self._camera_settings.fall_threshold:
            movement_type = MovementType.FALL
        elif movement > self._camera_settings.running_threshold:
            movement_type = MovementType.RUNNING
        elif movement > self._camera_settings.movement_threshold:
            movement_type = MovementType.WALKING
        
        movement_data = {
            "type": movement_type.value,
            "confidence": confidence,
            "movement_value": float(movement)
        }
        
        self._movement_history.append(movement_data)
        return movement_data

    def get_camera_stats(self) -> Dict[str, Any]:
        """
        Get current camera and movement statistics.
        """
        return {
            "is_capturing": self._is_capturing,
            "capture_count": self._capture_count,
            "settings": self._camera_settings.__dict__,
            "recent_movements": self._movement_history[-10:] if self._movement_history else []
        }

    def track_belt_open(self) -> Dict[str, Any]:
        """
        Track when the belt is opened.
        Returns a dictionary with tracking information.
        """
        current_time = time.time()
        self._last_open_time = current_time
        self._is_open = True
        self._total_opens += 1
        
        tracking_data = {
            "timestamp": current_time,
            "action": "open",
            "total_opens": self._total_opens,
            "is_open": self._is_open
        }
        
        logger.info(f"Belt opened at {current_time}")
        return tracking_data

    def track_belt_close(self) -> Dict[str, Any]:
        """
        Track when the belt is closed.
        Returns a dictionary with tracking information.
        """
        if not self._is_open:
            logger.warning("Attempted to close belt that wasn't open")
            return {
                "timestamp": time.time(),
                "action": "close",
                "error": "Belt was not open"
            }

        current_time = time.time()
        self._last_close_time = current_time
        self._is_open = False
        
        # Calculate duration if we have an open time
        if self._last_open_time is not None:
            self._open_duration = current_time - self._last_open_time
        
        tracking_data = {
            "timestamp": current_time,
            "action": "close",
            "duration": self._open_duration,
            "is_open": self._is_open
        }
        
        logger.info(f"Belt closed at {current_time}, duration: {self._open_duration:.2f} seconds")
        return tracking_data

    def get_tracking_stats(self) -> Dict[str, Any]:
        """
        Get current tracking statistics.
        """
        return {
            "is_open": self._is_open,
            "last_open_time": self._last_open_time,
            "last_close_time": self._last_close_time,
            "total_opens": self._total_opens,
            "current_open_duration": time.time() - self._last_open_time if self._is_open and self._last_open_time else 0.0
        } 