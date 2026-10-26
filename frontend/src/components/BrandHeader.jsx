import billsrLogo from '../assets/billsr-logo.jpg';

export default function BrandHeader() {
  return (
    <header className="brand-header">
      <img className="brand-logo" src={billsrLogo} alt="Billsr" />
      <h1 id="portal-title">Billsr Operations Portal</h1>
    </header>
  );
}
