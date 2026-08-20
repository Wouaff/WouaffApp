export default function DmcaBadge() {
  return (
    <>
      <a
        href="//www.dmca.com/Protection/Status.aspx?ID=eb48d4d9-aa6c-437d-bee5-e9acb198c2a3"
        title="DMCA.com Protection Status"
        className="dmca-badge"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src="https://images.dmca.com/Badges/dmca_protected_sml_120n.png?ID=eb48d4d9-aa6c-437d-bee5-e9acb198c2a3"
          alt="DMCA.com Protection Status"
          width={120}
          height={45}
          loading="lazy"
        />
      </a>
      <script src="https://images.dmca.com/Badges/DMCABadgeHelper.min.js" defer />
    </>
  );
}
