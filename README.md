# KaniCasino
<a href="https://kanicasino.novadrake.com" target="_blank" rel="noreferrer">Kanicasino.novadrake.com</a> is a open source online casino. This version doesn't involve real money. <br/><br/>
Users can play live games such as <b>Crash</b> and <b>Coin Flip</b>, and open cases in a Counter-Strike-like <b>case system</b>. Every 8 minutes, the players receive a refill in their balance, so they can continue playing and collecting items. Users can also sell and buy items in the <b>Marketplace</b>, creating a economy based on the rarity of the items.

You can talk with me about the project in discord, add me: novadrake76

## Instalation ##
This project uses NodeJS + Express + WebSockets in the backend, and ReactJS + Vite + Typescript + TailwindCSS in the frontend. <br/>Here, you can create your own items and cases.<br/><br/>
If you want to run only the Front-end, please run `npm install` to install the dependencies, then use `npm run dev`.
Create a .env file on the root folder, and set a `VITE_BASE_URL` with value `https://kaniback.onrender.com`. (this is the STG API, that can spin down with inactivity, which can delay requests by 50 seconds or more) 


If you want to run the Back-end and the Front-end, change the `VITE_BASE_URL` to localhost in the `.env` on the root folder, install the dependencies on the root folder and in the backend folder, then create a .env on your backend folder, create the following variables (adjust as you wish):
JWT_SECRET
MONGO_URI
PORT
then, use `npm run start`.

Please note that the database access is not public; you can make your own database using MongoDB, or anything else. 

# To-Do
- [ ] Add friend.
- [ ] Item battle.
- [ ] Fixed navbar when scrolling.



![image](https://github.com/NovaDrake76/KaniCasino/assets/65428910/b7e025e1-25ad-46b6-a7d8-ace72d5804e2)

