import Rarities from "../Rarities";
import { RiDoubleQuotesL } from "react-icons/ri";
import { BiEditAlt } from "react-icons/bi";
import { putFixDescription, updateProfilePicture } from "../../services/users/UserServices";
import { useState } from "react";
import { Tooltip } from "react-tooltip";
import { useRef } from "react";
import { toast } from "react-toastify";

interface UserProps {
  user: {
    id: number;
    username: string;
    profilePicture: string;
    level: number;
    xp: number;
    fixedItem: {
      name: string;
      image: string;
      rarity: number;
      description: string;
    };
  };
  isSameUser: boolean;
  setRefresh?: React.Dispatch<React.SetStateAction<boolean>>;
}

const getPercentX = (x: number, y: number) => {
  return Math.round((x / y) * 100);
};

const getPercentY = (x: number, y: number) => {
  const xPercent = getPercentX(x, y);

  return 100 - xPercent;
};

const UserInfo: React.FC<UserProps> = ({
  user: { profilePicture, level, username, xp, fixedItem },
  isSameUser,
  setRefresh,
}) => {
  const [description, setDescription] = useState<string>(
    fixedItem ? fixedItem.description : ""
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  const updateFixDescription = async (description: string) => {
    try {
      await putFixDescription(description);
      setRefresh && setRefresh((prev) => !prev);

    } catch (error) {
      console.log(error);
    }
  };

  // Create a reference to the file input element
  const fileInput = useRef<HTMLInputElement>(null);

  // This function will be called when the user selects a new profile picture
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileSizeMB = file.size / 1024 / 1024; // size in MB
      const validFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      const isValidFileType = validFileTypes.includes(file.type);

      if (fileSizeMB > 3) {
        toast.error('File size must be less than 3MB');
        return;
      }

      if (!isValidFileType) {
        toast.error('File type must be jpeg, jpg or png');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const res = await updateProfilePicture(reader.result as string);
          setRefresh && setRefresh(true);
          toast.success(res.message);


        } catch (error: any) {
          console.log(error);
          toast.error(error.message);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePictureClick = () => {
    fileInput.current?.click();
  };

  const TextArea = () => {
    return (
      <div className="flex flex-col items-center justify-center ">
        <textarea
          className="w-36 h-16 rounded-lg bg-white p-2 text-black resize-none "
          maxLength={50}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
        />
        <button
          className="bg-blue-500 rounded-lg px-4 py-2 mt-2"
          onClick={() => {
            updateFixDescription(description);
            setIsEditing(false);
          }}
        >
          Save
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between w-full">
      <div className="flex flex-col lg:flex-row items-center gap-7">
        <div className="relative group">
          <img
            src={profilePicture ? profilePicture : "https://i.imgur.com/uUfJSwW.png"}
            alt="avatar"
            className="w-36 h-36 rounded-full object-cover border-2 border-blue-500 p-1"
          />
          {isSameUser && (
            <button
              className="absolute inset-0 w-full h-full opacity-0 hover:opacity-70 bg-blue-500 transition-all flex items-center justify-center rounded-full cursor-pointer group-hover:opacity-70"
              onClick={handleChangePictureClick}
            >
              <span className="text-white">Change Picture</span>
            </button>
          )}
          <input
            type="file"
            className="hidden"
            onChange={handleProfilePictureChange}
            ref={fileInput}
            accept="image/png, image/jpeg, image/jpg"
          />
          <div className="absolute text-base font-semibold top-28 left-28 rounded-full bg-blue-500 min-w-[24px] h-6 flex justify-center items-center ">
            {level}
          </div>
        </div>
        <div className="flex flex-col w-[686px]">
          <span className="text-2xl font-semibold color-[#dddcfc]">
            {username}
          </span>
          <div className="flex flex-col gap-2 mt-5">
            <div className="flex w-full">
              <div
                className={`h-1 bg-blue-400 rounded rounded-l-none z-10`}
                style={{
                  width: `${getPercentX(xp - level * 1000, 1000)}%`,
                }}
              />{" "}
              <div
                className={`h-1 bg-[#3a365a] rounded rounded-r-none -translate-x-1 z-0`}
                style={{
                  width: `${getPercentY(xp - level * 1000, 1000)}%`,
                }}
              />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-[#dddcfc] font-semibold">{`XP ${xp} / ${(level + 1) * 1000
                }`}</span>
              <Tooltip id="my-tooltip" />

              <span
                className="text-[#3a365a] underline -translate-x-1 cursor-help"
                data-tooltip-id="my-tooltip"
                data-tooltip-content="To every 1C₽ spent, you get 5 XP."
              >
                How XP works?
              </span>
            </div>
          </div>
        </div>
      </div>
      {fixedItem && (
        <div
          className="flex p-4 rounded  border-gray-800 min-w-[350px] h-44 notched"
          style={{
            backgroundImage: `linear-gradient(270deg, ${Rarities.find((rarity) => rarity.id == fixedItem.rarity)?.color
              } 20%, rgba(0,0,0,0) 100%)`,
          }}
        >
          <div className="flex items-center justify-between px-4 w-full">
            <div>
              {fixedItem.description ? (
                <div className="flex items-center justify-center">
                  <RiDoubleQuotesL className="text-2xl text-[#dddcfc]" />
                  {isEditing ? (
                    TextArea()
                  ) : (
                    <div
                      className="max-w-[160px] overflow-auto flex items-center transition-all"
                      onMouseEnter={() => {
                        setIsHovering(true);
                      }}
                      onMouseLeave={() => {
                        setIsHovering(false);
                      }}
                    >
                      <span className="text-center  overflow-auto max-w-[140px]">
                        {fixedItem.description ? description : "No description"}
                      </span>
                      {isSameUser && isHovering && (
                        <BiEditAlt
                          className="text-2xl text-[#dddcfc] cursor-pointer"
                          onClick={() => {
                            setIsEditing(true);
                          }}
                        />
                      )}
                    </div>
                  )}
                  <RiDoubleQuotesL className="text-2xl text-[#dddcfc] rotate-180" />
                </div>
              ) : (
                isSameUser && (
                  <div className="flex items-center justify-center">
                    <RiDoubleQuotesL className="text-2xl text-[#dddcfc]" />
                    {isEditing ? (
                      TextArea()
                    ) : (
                      <span
                        className="text-center flex items-center cursor-pointer"
                        onClick={() => {
                          setIsEditing(true);
                        }}
                      >
                        Edit Description <BiEditAlt />
                      </span>
                    )}

                    <RiDoubleQuotesL className="text-2xl text-[#dddcfc] rotate-180" />
                  </div>
                )
              )}
            </div>
            <div className="flex flex-col items-center justify-center justify-self-end">
              <img
                src={fixedItem.image}
                alt={fixedItem.name}
                className="w-24 h-24 object-contain rounded"
              />
              <div className="w-auto" />

              <p className="text-base py-2 font-semibold ">{fixedItem.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInfo;
