import React, { useEffect, useRef, useState } from "react"

const TruncatedText = ({ text }) => {
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false)
  const textRef = useRef(null)

  const safeText = String(text || "")

  useEffect(() => {
    const element = textRef.current
    if (!element) {
      return
    }

    const updateTooltip = () => {
      setShouldShowTooltip(element.scrollWidth > element.clientWidth)
    }

    updateTooltip()

    const observer = new ResizeObserver(() => {
      updateTooltip()
    })
    observer.observe(element)

    window.addEventListener("resize", updateTooltip)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateTooltip)
    }
  }, [safeText])

  return (
    <span
      ref={textRef}
      className='truncated-text'
      title={shouldShowTooltip ? safeText : ""}
    >
      {safeText}
    </span>
  )
}

export default TruncatedText;
