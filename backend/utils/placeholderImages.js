//list placehorder images, then return a random one
const placeholderImages = ["https://kanicases.s3.amazonaws.com/pfp.png"];

const getRandomPlaceholderImage = () => {
  return placeholderImages[
    Math.floor(Math.random() * placeholderImages.length)
  ];
};

module.exports = getRandomPlaceholderImage;
