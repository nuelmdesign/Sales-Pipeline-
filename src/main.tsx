import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MotionConfig } from "motion/react"

import "./index.css"
import App from "./App"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StoreProvider } from "@/crm/store"
import { AIProvider } from "@/crm/ai"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <AIProvider>
          <StoreProvider>
            <App />
            <Toaster position="bottom-left" />
          </StoreProvider>
        </AIProvider>
      </TooltipProvider>
    </MotionConfig>
  </StrictMode>
)
