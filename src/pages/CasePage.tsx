import { useState, useEffect } from "react";
import { getCase } from "../services/cases/CaseServices";
import Title from "../components/Title";
import Item from "../components/Item";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [openedItem, setOpenedItem] = useState<any>(null);

  //get id from url
  const id = window.location.pathname.split("/")[2];

  const getCaseInfo = async () => {
    getCase(id)
      .then((response) => {
        setData(response);
      })
      .catch((error: any) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getCaseInfo();
  }, []);

  const openCase = () => {
    const randomIndex = Math.floor(Math.random() * data.items.length);
    setOpenedItem(data.items[randomIndex]);
  };

  return (
    <div className="flex flex-col items-center w-screen">
      {loading ? (
        <div>
          <h1>Loading...</h1>
        </div>
      ) : (
        data && (
          <div className="flex flex-col items-center max-w-[1920px]">
            <h1>{data.title}</h1>
            <button onClick={openCase}>Open Case</button>
            {openedItem && (
              <div>
                <h2>You got:</h2>
                <p>{openedItem.name}</p>
                <img src={openedItem.image} alt={openedItem.name} />
              </div>
            )}
            <div className="flex flex-col p-20 gap-2 items-center ">
              <Title title="Items in this case " />
              <div className="flex flex-wrap gap-6  justify-center ">
                {data.items.map((item: any) => (
                  <Item item={item} />
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default CasePage;
