import { useMyListings } from "./MyListings.services";
import MyListingsView from "./MyListings.view";
import { MyListingsProps } from "./MyListings.types";

const MyListings: React.FC<MyListingsProps> = (props) => {
  const service = useMyListings(props);
  return <MyListingsView {...service} />;
};

export default MyListings;
