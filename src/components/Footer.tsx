import Modal from "./Modal";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TermsOfPrivacy from "./modalsChilden/TermsOfPrivacy"
import UserAgreement from "./modalsChilden/UserAgreement"
import HowToPlay from "./modalsChilden/HowToPlay"
import AboutTheMarket from "./modalsChilden/AboutTheMarket"
import HowGamesWork from "./modalsChilden/HowGamesWork";
import ContactUs from "./modalsChilden/ContactUs";
import FAQ from "./modalsChilden/FAQ";
import Artists from "./modalsChilden/Artists";
import LanguageSelector from "./LanguageSelector";
import i18n from "../i18n";

function Footer() {
  // Toggle modal
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<JSX.Element>(<></>);

  const navigate = useNavigate();

  const handleModalInfo = (content: JSX.Element) => {
    setModalContent(content);
    setShowModal(true);
  }

  const sections = [
    {
      title: i18n.t("footer.main"),
      links: [
        {
          title: i18n.t("footer.howToPlay"),
          onClick: () => handleModalInfo(<HowToPlay />),
        },
        {
          title: i18n.t("footer.aboutTheMarket"),
          onClick: () => handleModalInfo(<AboutTheMarket />),
        },
        {
          title: i18n.t("footer.howGamesWork"),
          onClick: () => handleModalInfo(<HowGamesWork />),
        },
      ],
    },
    {
      title: i18n.t("footer.aboutUs"),
      links: [
        {
          title: i18n.t("footer.termsOfPrivacy"),
          onClick: () => handleModalInfo(<TermsOfPrivacy />),
        },
        {
          title: i18n.t("footer.userAgreement"),
          onClick: () => handleModalInfo(<UserAgreement />),
        },
        {
          title: i18n.t("footer.artists"),
          onClick: () => handleModalInfo(<Artists />),
        }
      ],
    },
    {
      title: i18n.t("footer.games"),
      links: [
        {
          title: i18n.t("nav.crash"),
          onClick: () => navigate("/crash"),
        },
        {
          title: i18n.t("footer.coinflip"),
          onClick: () => navigate("/coinflip"),
        },
        {
          title: i18n.t("footer.slot"),
          onClick: () => navigate("/slot"),
        },
      ],
    },
    {
      title: i18n.t("footer.support"),
      links: [
        {
          title: i18n.t("footer.provablyFair"),
          onClick: () => navigate("/provably-fair"),
        },
        {
          title: i18n.t("footer.contactUs"),
          onClick: () => handleModalInfo(<ContactUs />),
        },
        {
          title: i18n.t("footer.faq"),
          onClick: () => handleModalInfo(<FAQ />),
        },
      ],
    }
  ];

  return (
    <footer className="flex flex-col items-center justify-center w-full py-6 text-white bg-[#110F1D] ">
      <Modal open={showModal} setOpen={setShowModal}>
        {modalContent}
      </Modal>

      <div className="flex flex-col items-center justify-center gap-2 p-1">
        <Link to="/">
          <div className="flex items-center ">
            <img
              src="/images/logo.webp"
              alt={i18n.t("common.logo")}
              className="w-36 h-24 object-contain"
            />

          </div>
        </Link>
        <span className="font-bold hidden md:flex">
          {i18n.t("footer.kanicasinoCasesUpgradeTouhou")}
        </span>
      </div>

      <div className="flex flex-col w-10/12 mt-2">
        <div className="w-full h-[1px] bg-gray-500 opacity-10" />
        <div className="flex flex-col md:flex-row mt-4">
          {
            sections.map((section, index) => (
              <div key={index} className="flex flex-col w-full gap-2 my-2">
                <span className="font-bold text-xl">{section.title}</span>
                <div className="flex flex-col gap-1">
                  {
                    section.links && section.links.map((link, index) => (
                      <span
                        key={index}
                        onClick={link.onClick}
                        className="cursor-pointer hover:underline text-sm"
                      >
                        {link.title}
                      </span>
                    ))
                  }
                </div>
              </div>
            ))
          }
        </div>
      </div>

      <div className="w-full mt-4 flex flex-col items-center justify-center gap-3">
        <div className="w-full h-[1px] bg-gray-500 opacity-10" />
        <div className="flex flex-col items-center gap-3 w-10/12 md:flex-row md:justify-between">
          <span className="text-sm text-center">
            KaniCasino © All Rights Reserved. {new Date().getFullYear()}
          </span>
          <LanguageSelector compact />
        </div>
      </div>


    </footer>
  );
}

export default Footer;
