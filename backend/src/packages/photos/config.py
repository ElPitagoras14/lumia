from pydantic_settings import BaseSettings, SettingsConfigDict

MAX_PHOTO_BYTES = 20 * 1024 * 1024
MAX_PHOTOS_PER_ALBUM = 50

# Longest side, in pixels, of each variant. imgproxy never enlarges, so a
# smaller original is served at its own size.
VARIANT_SIZES = {"thumb": 320, "deck": 1080, "viewer": 1920}


class PhotoSettings(BaseSettings):
    # Hide the values: a malformed key must not be echoed into the startup log.
    model_config = SettingsConfigDict(hide_input_in_errors=True)

    # Required on purpose: without the pair the backend would emit URLs that
    # imgproxy rejects, so startup stops instead.
    image_signing_key: str
    image_signing_salt: str

    # Where the upload's thumbnail is requested from to fill nginx's cache.
    # The default only resolves inside the compose network; natively the
    # warm-up just fails, which is harmless.
    image_warmup_base_url: str = "http://lumia-nginx"


photo_settings = PhotoSettings()
