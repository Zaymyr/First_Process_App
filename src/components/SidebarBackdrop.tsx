'use client';

export default function SidebarBackdrop() {
  return (
    <div
      className="sb-backdrop"
      onClick={() => {
        document.body.classList.remove('sidebar-open');
      }}
    />
  );
}
