export const money = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
export const productMoney = (value: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
