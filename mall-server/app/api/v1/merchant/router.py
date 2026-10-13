from fastapi import APIRouter

from app.api.v1.merchant import auth, dashboard, orders, products, shop

router = APIRouter(prefix="/merchant")
router.include_router(auth.router)
router.include_router(shop.router)
router.include_router(products.router)
router.include_router(orders.router)
router.include_router(dashboard.router)
