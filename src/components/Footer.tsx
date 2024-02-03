import Modal from "./Modal";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Footer() {
  // Toggle modal
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  return (
    <footer className="flex justify-around w-full p-20 mt-20 text-base">
      <div>
        <h4 className="flex gap-1">
          <img className="object-contain w-6 h-6" src="/images/logo.webp" />
          KaniCasino™
        </h4>
        <div className="pt-4 text-2xl ">
          {/* social medias */}
          <a
            target="_blank"
            className="px-2"
            href="https://github.com/NovaDrake76/KaniCasino"
          ></a>
          <a
            target="_blank"
            className="px-2"
            href="https://www.facebook.com/watanabot/"
          ></a>
        </div>
      </div>
      <div>
        <h4 className="pb-2">About us</h4>
        <div>
          <ul className="text-sm ">
            <li>
              {/* Button to toggle modal visibility */}
              <button
                className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
                onClick={() => setShowModal(true)}
              >
                Terms of Privacy
              </button>
              <Modal isVisible={showModal} onClose={() => setShowModal(false)}>
                {/* Modal children */}
                <div className="p-6">
                  {/* Modal title */}
                  <h3 className=" mb-5 text-xl font-semibold text-[#776ed7]">
                    Terms of Privacy
                  </h3>
                  {/* Modal Body */}
                  <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                    Aperiam quidem cumque quam ut ab nobis delectus saepe unde
                    quas dicta nesciunt soluta sint nisi temporibus explicabo
                    voluptates, aspernatur harum veniam.
                  </p>
                </div>
              </Modal>
            </li>

            <li className="py-2">
              <button
                className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
                onClick={() => setShowModal(true)}
              >
                User Agreement
              </button>
              <Modal isVisible={showModal} onClose={() => setShowModal(false)}>
                <div className="p-6">
                  <h3 className=" mb-5 text-xl font-semibold text-[#776ed7]">
                    User Agreement
                  </h3>
                  <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                    Aperiam quidem cumque quam ut ab nobis delectus saepe unde
                    quas dicta nesciunt soluta sint nisi temporibus explicabo
                    voluptates, aspernatur harum veniam.
                  </p>
                </div>
              </Modal>
            </li>
          </ul>
        </div>
      </div>
      <div>
        <h4>Games</h4>
        <ul className="text-sm ">
          <li className="py-2">
            {/* Links for navigate to games */}
            <button
              className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
              onClick={() => navigate("/crash")}
            >
              Crash
            </button>
          </li>
          <li>
            <button
              className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
              onClick={() => navigate("/coinflip")}
            >
              Coinflip
            </button>
          </li>
          <li className="py-2">
            <button
              className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
              onClick={() => navigate("/upgrade")}
            >
              Upgrade
            </button>
          </li>
          <li>
            <button
              className="bg-inherit text-[#646cff] border-none focus:outline-none p-0"
              onClick={() => navigate("/slot")}
            >
              Slot
            </button>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export default Footer;
