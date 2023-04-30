import Banner from "../components/Banner";

const Home = () => {
  return (
    <div className="w-full flex justify-center">
      <div className="flex max-w-[1920px]">
        <Banner image={"/images/HomeBanner.webp"} />
      </div>
    </div>
  );
};

export default Home;
