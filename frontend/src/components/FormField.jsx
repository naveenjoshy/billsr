export default function FormField({ htmlFor, icon, label, children }) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      <div className={`input-wrap${icon ? '' : ' input-wrap-no-icon'}`}>
        {icon && <img className="field-icon" src={icon} alt="" />}
        {children}
      </div>
    </div>
  );
}
