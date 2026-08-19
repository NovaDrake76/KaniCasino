import i18n from "../../i18n";
const Assets = () => {
    return (
        <div className="p-4">
            <span className="text-2xl font-bold mb-4">{i18n.t("footer.artists")}</span>

            <p className="text-sm mb-4 text-justify">
                If you have an asset of your belonging that's being used in this website without permission, please contact me at <a href="mailto:novadrake76@gmail.com" className="text-blue-500">{i18n.t("help.novadrake76GmailCom")}</a> to request the removal.
            </p>

            <div className="mb-4 flex flex-col gap-2">
                <span className="text-xl font-bold mb-2">{i18n.t("help.cases")}</span>
                <p className="text-md">
                    All Touhou items are from dairi: <a href="https://www.pixiv.net/en/users/4920496" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsWwwPixivNet")}</a>.
                </p>

                <p className="text-md">
                    All Counter-Strike items are from Valve: <a href="https://store.steampowered.com/app/730/CounterStrike_2/" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsStoreSteampoweredCom")}</a>.
                </p>

                <p className="text-md">
                    All cats items are from the Hello Street Cat Wiki: <a href="https://streetcat.wiki/index.php/Main_Page" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsStreetcatWikiIndex")}</a>.
                </p>

                <p className="text-md">
                    All Uma Musume items are from Cygames: <a href="https://umamusume.jp/" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsUmamusumeJp")}</a>.
                </p>

                <p className="text-md">
                    All Blue Archive items are from NEXON Games: <a href="https://bluearchive.nexon.com/" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsBluearchiveNexonCom")}</a>.
                </p>
            </div>

            <div className="mb-4 flex flex-col gap-2">
                <span className="text-xl font-bold mb-2">{i18n.t("footer.games")}</span>
                <p className="text-md">
                    Crash arts and banner art are from Urban Legend in Limbo.
                </p>

                <p className="text-md">
                   {i18n.t("help.slotArtCredit")} <br/> {i18n.t("help.mikeArtCredit")} <a href="https://x.com/kamepan44231/status/1641809628412477446" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsXComKamepan44231")}</a>.
                </p>

                <p className="text-md">
                  Coinflip arts are from azumammeri: <a href="https://x.com/azumammeri" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsXComAzumammeri")}</a>.
                </p>

                <p className="text-md">
                   The Cirno profile picture is from AshleyChan-D: <a href="https://www.deviantart.com/ashleychan-d/art/Cirno-Fumo-Fanart-854752870" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsWwwDeviantartCom")}</a>.
                </p>

                <p className="text-md">
                   The Casino banner picture is from Gensokyo 2077: <a href="https://www.pixiv.net/en/artworks/110665474" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsWwwPixivNet2")}</a>.
                </p>

                <p className="text-md">
                   The Mike banner picture is from Azura: <a href="https://www.pixiv.net/en/users/106357304" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsWwwPixivNet3")}</a>.
                </p>


                <p className="text-md">
                   The Joon logo is from 忍忍: <a href="https://www.pixiv.net/en/artworks/66805800" target="_blank" rel="noreferrer" className="text-blue-500">{i18n.t("help.httpsWwwPixivNet4")}</a>.
                </p>
                
            </div>
        </div>
    );
};

export default Assets;
