import { useEffect, useState } from "react";
import { loadStore } from "@/lib/anemia/storage";
import type { StoreShape } from "@/lib/anemia/types";

export function useStore(): StoreShape {
  const [s, setS] = useState<StoreShape>({ patients: [], tests: {} });
  useEffect(() => {
    const update = () => setS(loadStore());
    update();
    window.addEventListener("anemia-store-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("anemia-store-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return s;
}
