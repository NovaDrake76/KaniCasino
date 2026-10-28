import CouponView from "./Coupon.view";
import { useCouponServices } from "./Coupon.services";

const Coupon = () => {
  const service = useCouponServices();
  return <CouponView {...service} />;
};

export default Coupon;
