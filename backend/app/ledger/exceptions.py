class LedgerException(Exception):
    """Base exception for ledger operations."""
    pass

class InsufficientStockException(LedgerException):
    """Raised when on-hand stock is insufficient and no manager override is provided."""
    def __init__(self, message: str, product_id=None, location_id=None, available=None, requested=None):
        super().__init__(message)
        self.product_id = product_id
        self.location_id = location_id
        self.available = available
        self.requested = requested

class InvalidMovementException(LedgerException):
    """Raised when movement parameters are invalid (e.g. non-positive quantity, identical source/destination)."""
    pass

class UnauthorizedOverrideException(LedgerException):
    """Raised when a non-manager attempts to force negative stock."""
    pass
