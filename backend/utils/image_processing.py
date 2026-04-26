from PIL import Image


def handle_transparent_images(image: Image.Image) -> Image.Image:
    if image.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        background.paste(image, mask=image.split()[-1])
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    return image


def strip_metadata(image: Image.Image) -> Image.Image:
    return Image.frombytes(image.mode, image.size, image.tobytes())
