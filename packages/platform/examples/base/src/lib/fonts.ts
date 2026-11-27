import localFont from "next/font/local";

export const inter = localFont({
  src: "../../../../../../apps/web/public/fonts/Inter-roman.var.woff2",
  display: "swap",
  weight: "100 900",
});

export const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
});
