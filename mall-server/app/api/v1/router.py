from fastapi import APIRouter

from app.api.v1 import addresses, ai, auth, banners, cart, coupons, cs, orders, products, shops
from app.api.v1.admin.router import router as admin_router
from app.api.v1.merchant.router import router as merchant_router

router = APIRouter(prefix="/api/v1")


@router.get("/health")
async def health():
    return {"code": 0, "message": "ok", "data": {"status": "up"}}


router.include_router(auth.router)
router.include_router(products.router)
router.include_router(shops.router)
router.include_router(banners.router)
router.include_router(cart.router)
router.include_router(addresses.router)
router.include_router(coupons.router)
router.include_router(orders.router)
router.include_router(cs.router)
router.include_router(ai.router)
router.include_router(merchant_router)
router.include_router(admin_router)
