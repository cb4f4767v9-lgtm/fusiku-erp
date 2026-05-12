from django.utils import timezone


def check_license(company=None):
    """
    Temporary license check (bypassed for development)
    Later this will validate expiry, device, signature, etc.
    """

    # TODO: replace with real validation later
    return True


def enforce_license(company=None):
    """
    Enforce license (used in views/middleware)
    """
    if not check_license(company):
        raise Exception("License expired or invalid")
