import { IoMdClose } from "react-icons/io";
import i18n from "../i18n";

interface ModalProps {
  children: JSX.Element;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  width?: string;
}

const Modal: React.FC<ModalProps> = ({ children, open, setOpen, width = "600px" }) => {
  if (!open) return null;

  /* function to close when clicking outside modal */
  const handleClose = (e: any) => {
    if (e.target.id === "wrapped") {
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25 z-[999]"
      id="wrapped"
      onClick={handleClose}
    >
      <div className={` max-h-[70vh] flex flex-col overflow-auto`} style={{
        width: width
      }}
        aria-label={i18n.t("common.modal")}
      >
        <div className="p-6 text-white rounded bg-[#19172D] relative">

          {/* X button to close modal */}
          <button
            className="absolute top-2 right-2 text-2xl bg-none  border-none place-self-end bg-inherit focus:outline-none"
            onClick={() => setOpen(false)}
            aria-label={i18n.t("common.closeModal")}
          >
            <IoMdClose />
          </button>

          {/* all Modal content */}
          <div className="mt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
