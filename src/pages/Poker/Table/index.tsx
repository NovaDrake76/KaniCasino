import TableView from "./Table.view";
import { useTableServices } from "./Table.services";

const PokerTable = () => {
  const service = useTableServices();
  return <TableView {...service} />;
};

export default PokerTable;
