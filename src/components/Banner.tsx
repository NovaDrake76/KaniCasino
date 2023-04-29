interface BannerProps {
  image: any;
}

const Banner: React.FC<BannerProps> = ({ image }) => {
  return (
    <div className={`flex w-screen h-[460px] bg-[url('${image}')]`}>a</div>
  );
};

export default Banner;
