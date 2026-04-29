import { useEffect, useRef, useState, useMemo } from "react";

const VERSION = "26.4.19";

const Footer = () => {
  const footerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);

  // Année actuelle pour le copyright
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const footerElement = footerRef.current;
    if (!footerElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.1,
      }
    );

    observer.observe(footerElement);

    return () => {
      observer.unobserve(footerElement);
    };
  }, []);

  return (
    <footer 
      ref={footerRef} 
      className={`footer ${isVisible ? "" : "hidden"}`}
      role="contentinfo"
    >
      <div className="footer-content">
        <span>Version {VERSION}</span>
        <span> | </span>
        <span>Réalisé par l'ETML/CFPV</span>
        <span> | </span>
        <span>© {currentYear} TPI Organizer - Tous droits réservés</span>
      </div>
    </footer>
  );
};

export default Footer;
