import base64
import logging
from io import BytesIO

logger = logging.getLogger(__name__)

# Check if OpenCV and NumPy are available
OPENCV_AVAILABLE = False
try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

# Check if Pillow is available for header validation & decompression bomb prevention
PIL_AVAILABLE = False
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

MAX_IMAGE_PIXELS = 25_000_000  # 25 Megapixels (e.g. 5000x5000)
MAX_DIMENSION = 6000  # Max width or height in pixels


def detect_faces_in_image(image_bytes, min_size=(30, 30)):
    """
    Detect faces in uploaded image bytes using OpenCV Haar Cascade when available.
    Fails closed if the engine is unavailable, the image is malformed,
    or the dimensions exceed safe decompression limits.
    Never invents or fabricates candidate faces.
    """
    if not image_bytes:
        return {
            'success': False,
            'error': 'The uploaded photo is empty.',
            'faces_count': 0,
            'faces': []
        }

    if not OPENCV_AVAILABLE:
        return {
            'success': False,
            'error': 'Local face detection is unavailable because OpenCV is not installed.',
            'faces_count': 0,
            'faces': []
        }

    # Pre-validation with Pillow to guard against decompression bombs and corrupted files
    if PIL_AVAILABLE:
        try:
            Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
            with Image.open(BytesIO(image_bytes)) as pil_img:
                pil_img.verify()

            # Re-read to check dimensions safely
            with Image.open(BytesIO(image_bytes)) as pil_img:
                w, h = pil_img.size
                if w > MAX_DIMENSION or h > MAX_DIMENSION or (w * h) > MAX_IMAGE_PIXELS:
                    return {
                        'success': False,
                        'error': f'Image dimensions ({w}x{h}) exceed safe processing limits (maximum {MAX_DIMENSION}x{MAX_DIMENSION} or {MAX_IMAGE_PIXELS} pixels).',
                        'faces_count': 0,
                        'faces': []
                    }
        except Image.DecompressionBombError:
            return {
                'success': False,
                'error': 'Image rejected: decompression bomb detected.',
                'faces_count': 0,
                'faces': []
            }
        except Exception as err:
            logger.warning("Pillow image verification failed: %s", err)
            return {
                'success': False,
                'error': 'The uploaded file is not a valid decodable image.',
                'faces_count': 0,
                'faces': []
            }

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {
                'success': False,
                'error': 'The uploaded file is not a valid decodable image.',
                'faces_count': 0,
                'faces': []
            }

        h_img, w_img, _ = img.shape
        if w_img > MAX_DIMENSION or h_img > MAX_DIMENSION or (w_img * h_img) > MAX_IMAGE_PIXELS:
            return {
                'success': False,
                'error': f'Image dimensions ({w_img}x{h_img}) exceed safe processing limits.',
                'faces_count': 0,
                'faces': []
            }

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            logger.error("Haar cascade classifier could not be loaded from %s", cascade_path)
            return {
                'success': False,
                'error': 'Face detector model failed to load.',
                'faces_count': 0,
                'faces': []
            }

        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=min_size
        )

        results = []
        for idx, (x, y, w, h) in enumerate(faces):
            crop = img[max(0, y):min(h_img, y + h), max(0, x):min(w_img, x + w)]
            _, buffer = cv2.imencode('.jpg', crop)
            crop_b64 = base64.b64encode(buffer).decode('utf-8')

            results.append({
                'id': idx + 1,
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'confidence': 95.0,
                'crop_base64': f"data:image/jpeg;base64,{crop_b64}"
            })

        return {
            'success': True,
            'engine': 'OpenCV Haar Cascade',
            'faces_count': len(results),
            'image_width': w_img,
            'image_height': h_img,
            'faces': results
        }
    except Exception as err:
        logger.warning("OpenCV face detection failed: %s", err)
        return {
            'success': False,
            'error': 'The image could not be processed by the local face detector.',
            'faces_count': 0,
            'faces': []
        }
