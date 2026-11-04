import { Banknote, HeartPulse, Sparkles, Truck } from "lucide-react";
import styles from "./offer-strip.module.css";

const offers = [
  { icon: Sparkles, title: "Up to 50% off", detail: "selected offers", highlight: true },
  { icon: Truck, title: "Free delivery across Pakistan", detail: "on orders Rs 15,000+" },
  { icon: Banknote, title: "Cash on delivery", detail: "pay at your doorstep" },
  { icon: HeartPulse, title: "Care for every day", detail: "explore medical essentials" },
];

export default function OfferStrip() {
  return <div className={styles.strip} data-offer-strip>
    <div className={styles.track}>
      {[0,1].map(copy => <ul key={copy} className={styles.group} aria-label={copy === 0 ? "Store offers" : undefined} aria-hidden={copy === 1 ? true : undefined}>
        {offers.map(({icon:Icon,title,detail,highlight}) => <li key={title} className={highlight ? styles.highlight : undefined}><Icon size={15} strokeWidth={1.7}/><strong>{title}</strong><span>{detail}</span><i aria-hidden="true"/></li>)}
      </ul>)}
    </div>
  </div>;
}
