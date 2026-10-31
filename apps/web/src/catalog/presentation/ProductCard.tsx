import { useState } from "react";
import type { Product } from "@bazak/shared";
import { formatPrice } from "../domain/formatPrice";
export function ProductCard({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="product-card">
      <div className="product-image">
        {failed ? (
          <span>Image unavailable</span>
        ) : (
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
        <span className="product-category">
          {product.category.replaceAll("-", " ")}
        </span>
      </div>
      <div className="product-body">
        <div className="price-row">
          <strong>{formatPrice(product.price, product.currency)}</strong>
          {product.rating != null && <span>★ {product.rating.toFixed(1)}</span>}
        </div>
        <h3>{product.title}</h3>
        <p>{product.description}</p>
      </div>
    </article>
  );
}
