export type Product = {
  id: number; name: string; category: string; price: number; compareAt?: number;
  rating: number; reviews: number; badge?: string; palette: [string, string];
  art: "headphones" | "watch" | "speaker" | "camera" | "lamp" | "bag";
};

export const categories = [
  { name: "Audio", icon: "wave", tone: "#e8f1ff" }, { name: "Wearables", icon: "watch", tone: "#f3edff" },
  { name: "Home", icon: "home", tone: "#fff2df" }, { name: "Cameras", icon: "camera", tone: "#e8f8f1" },
  { name: "Workspace", icon: "lamp", tone: "#ffecef" }, { name: "Travel", icon: "bag", tone: "#edf0f7" },
];

export const products: Product[] = [
  { id: 1, name: "Arc Studio Wireless Headphones", category: "Audio", price: 28999, compareAt: 34999, rating: 4.9, reviews: 128, badge: "Best seller", palette: ["#d9e9ff", "#3977d8"], art: "headphones" },
  { id: 2, name: "Nova S2 Smart Watch", category: "Wearables", price: 18499, compareAt: 21999, rating: 4.8, reviews: 86, badge: "New", palette: ["#eee6ff", "#6d56a5"], art: "watch" },
  { id: 3, name: "Drift Mini Bluetooth Speaker", category: "Home", price: 8499, rating: 4.7, reviews: 214, palette: ["#e8f6ef", "#2f7d62"], art: "speaker" },
  { id: 4, name: "Frame One Compact Camera", category: "Cameras", price: 42999, compareAt: 48999, rating: 4.9, reviews: 64, badge: "Limited", palette: ["#fff0dc", "#c8762d"], art: "camera" },
  { id: 5, name: "Halo Adjustable Desk Lamp", category: "Workspace", price: 6750, rating: 4.6, reviews: 47, palette: ["#ffe9ed", "#b94e66"], art: "lamp" },
  { id: 6, name: "Weekender Carry All Bag", category: "Travel", price: 11999, compareAt: 14999, rating: 4.8, reviews: 93, palette: ["#e9edf5", "#4c5d7d"], art: "bag" },
];

export const money = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);
