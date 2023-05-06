import { useState, useEffect } from "react";
import { getCase } from "../services/cases/CaseServices";
import Title from "../components/Title";
import Item from "../components/Item";
import Roulette from "../components/Roullete";

const CasePage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [started, setStarted] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<any>(null);
  const [showPrize, setShowPrize] = useState<boolean>(false);

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
    setStarted(true);
    setShowPrize(false);
    setOpenedItem(data.items[Math.floor(Math.random() * data.items.length)]);

    setTimeout(() => {
      setStarted(false);
      setShowPrize(true);
    }, 6300);
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
            {started && (
              <Roulette items={data.items} opened={openedItem} spin={started} />
            )}
            {showPrize && (
              <div>
                <h2>You got:</h2>
                <p>{openedItem.name}</p>
                <img
                  src={openedItem.image}
                  alt={openedItem.name}
                  className="w-48 h-48 object-cover"
                />
              </div>
            )}
            <div className="flex flex-col p-20 gap-2 items-center ">
              <Title title="Items in this case" />
              <div className="flex flex-wrap gap-6  justify-center ">
                {data.items.map((item: any) => (
                  <Item item={item} key={item.name} />
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
