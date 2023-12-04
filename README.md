# KaniCasino
<a href="https://kanicasino.novadrake.com" target="_blank" rel="noreferrer">Kanicasino.novadrake.com</a> is a open source online casino. This version doesn't involve real money. <br/><br/>
Users can play live games such as <b>Crash</b> and <b>Coin Flip</b>, and open cases in a Counter-Strike-like <b>case system</b>. Every 1 hour, the players receive a refill in their balance, so they can continue playing and collecting items. Users can also sell and buy items in the <b>Marketplace</b>, creating a economy based on the rarity of the items.

## Instalation ##
This project uses NodeJS + Express + WebSockets in the backend, and ReactJS + Vite + Typescript + TailwindCSS in the frontend. <br/>Here, you can create your own items and cases.<br/><br/>
If you want to run only the Front-end, please run `npm install` to install the dependencies, then use `npm run dev`.


If you want to run the Back-end and the Front-end, change the `VITE_BASE_URL` to localhost in the `.env` on the root folder, install the dependencies on the root folder and in the backend folder, then create a .env on your backend folder, create the following variables (adjust as you wish):
JWT_SECRET
MONGO_URI
PORT
then, use `npm run start`.

Please note that the database access is not public; you can make your own database using MongoDB, or anything else. 

# To-Do
- [x] Fix PFP upload.
- [x] Fix Inventory.
- [x] Fix Netlify URL.
- [x] Scroll history.
- [x] Profile Inventory Height.
- [x] Fix Negative Sell.
- [x] Coin Flip.
- [x] Marketplace.
- [x] Crash.
- [x] CoinFlip Input.
- [X] Fix Market Modal.
- [x] Migrate backend to AWS, render sucks.
- [x] Fix login modal rerender on live history.
- [x] Search on profile.
- [x] Item notification information.
- [x] Fix Level.
- [x] Upgrade clock animation.
- [ ] Refresh Token.
- [ ] Responsivity.
- [ ] Banner content.
- [ ] Fix profile picture file error.
- [ ] Add friend.
- [ ] Item battle.
- [ ] PFP border color per level.
- [ ] Fixed navbar when scrolling.



![image](https://github.com/NovaDrake76/KaniCasino/assets/65428910/b7e025e1-25ad-46b6-a7d8-ace72d5804e2)

