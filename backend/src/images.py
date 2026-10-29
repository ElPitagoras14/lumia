import base64
import hashlib
import hmac
from typing import Literal

from src.packages.photos.config import VARIANT_SIZES, photo_settings

Variant = Literal["thumb", "deck", "viewer"]

# Mounted by nginx on the same prefix imgproxy is configured with
# (IMGPROXY_PATH_PREFIX), which imgproxy strips before checking the signature.
_URL_PREFIX = "/images"


def variant_url(storage_key: str, variant: Variant) -> str:
    """A signed imgproxy URL for one variant of an original. Pure: no expiry
    and no timestamp, so the same photo and variant always give the same URL
    and nginx's cache can serve it. The backend never transforms the image.
    """
    size = VARIANT_SIZES[variant]
    path = f"/rs:fit:{size}:{size}/plain/local:///photos/{storage_key}@webp"
    digest = hmac.new(
        bytes.fromhex(photo_settings.image_signing_key),
        bytes.fromhex(photo_settings.image_signing_salt) + path.encode(),
        hashlib.sha256,
    ).digest()
    signature = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return f"{_URL_PREFIX}/{signature}{path}"
