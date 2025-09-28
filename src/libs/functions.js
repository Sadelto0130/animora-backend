import { nanoid } from "nanoid";

const generateNumber = (min, max, digits = 2) => {
  const num = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(num).padStart(digits, "0");
}

export const generateUsername = async (email) => {
  let userName = email.split("@")[0] + "_" + nanoid().substring(0, 5);
  return userName;
}

export const createAvatar = async (name, last_name) => {
  const brows = `variant${generateNumber(1, 13)};`
  const glassesProbability = `variant${generateNumber(0, 100)};`
  const lips = `variant${generateNumber(1, 30)};`
  const nose = `variant${generateNumber(1, 20)};`

  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${name},${last_name}?radius=40?brows=${brows}?glassesProbability=${glassesProbability}?lips=${lips}?nose=${nose}`;
}

export const imageName = () => {
  const date = new Date()
  const imageName = `${nanoid()}-${date.getTime()}.jpeg`

  return imageName;
}