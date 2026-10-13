from fastapi import APIRouter

from app.api.v1.admin import auth, banners, categories, coupons, dashboard, orders, products, settings, shops, users

router = APIRouter(prefix="/admin")
router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(shops.router)
router.include_router(categories.router)
router.include_router(products.router)
router.include_router(orders.router)
router.include_router(users.router)
router.include_router(banners.router)
router.include_router(coupons.router)
router.include_router(settings.router)
