# Christ Embassy Abuja Zone 1 CMS - Design Guidelines

## Design Approach
**Selected Approach:** Design System + Dashboard References
- **Primary System:** Material Design principles for data-rich interfaces
- **Dashboard References:** Linear (clean layouts), Notion (organized content), Asana (task management patterns)
- **Justification:** Church admin systems require trustworthy professionalism with efficient data management. Material Design provides proven patterns for complex information architecture while modern dashboard aesthetics ensure contemporary feel.

## Typography System
**Font Family:** Inter (Google Fonts) for all text - exceptional readability for data-heavy interfaces
- **H1/Page Headers:** 2xl (24px), Semibold (600) - Page titles
- **H2/Section Headers:** xl (20px), Semibold (600) - Card headers, section dividers
- **H3/Subsections:** lg (18px), Medium (500) - Table headers, form sections
- **Body Text:** base (16px), Regular (400) - Primary content, form labels
- **Small/Meta Text:** sm (14px), Regular (400) - Timestamps, secondary info, table cells
- **Tiny/Helper:** xs (12px), Regular (400) - Badges, helper text

## Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4, p-6
- Section margins: mb-6, mb-8
- Grid gaps: gap-4, gap-6
- Card spacing: p-6 interior

**Dashboard Structure:**
- Sidebar: Fixed, w-64, full height - navigation menu
- Main Content: ml-64 offset, min-h-screen
- Top Bar: h-16, sticky header with breadcrumbs, search, user profile
- Content Container: max-w-7xl mx-auto, px-6 py-8

## Component Library

**Sidebar Navigation:**
- Logo section at top (h-16, p-4)
- Navigation groups with labels (uppercase, xs, semibold, mb-2, px-4)
- Menu items: px-4, py-3, rounded-lg, flex items with icons (20px) + text
- Active state: filled background, semibold text
- Hover state: subtle background
- Bottom section for settings/logout

**Top Bar:**
- Left: Breadcrumb navigation (Home > Members > Add Member pattern)
- Center: Global search bar (w-96, rounded-full)
- Right: Notifications bell icon, user avatar + name dropdown

**Dashboard Cards:**
- Stats Cards: Grid layout (grid-cols-4, gap-6)
  - Icon (32px) in circle at top-left
  - Large number (3xl, bold) for metric
  - Label text below (sm, medium)
  - Trend indicator with arrow + percentage (xs)
  
**Data Tables:**
- Container: Rounded-lg, shadow-sm, overflow-hidden
- Header row: bg-subtle, px-6 py-4, uppercase xs semibold
- Data rows: px-6 py-4, border-b, hover effect
- Columns: Member photo (40px circle) + name, contact, join date, status, actions
- Action buttons: Icon buttons (edit, delete, view) in row
- Pagination: Bottom-right, showing "1-10 of 234" with prev/next arrows

**Forms:**
- Two-column grid (grid-cols-2, gap-6) for efficiency
- Input groups: Label (sm, medium, mb-2), input field (px-4 py-3, rounded-lg, border)
- Required fields: Red asterisk after label
- Form sections: Divider with section title (lg, semibold, mb-4)
- Submit buttons: Right-aligned, primary button + secondary cancel
- Photo upload: Square placeholder (h-32 w-32) with "Upload Photo" centered

**Buttons:**
- Primary: px-6 py-3, rounded-lg, semibold
- Secondary: px-6 py-3, rounded-lg, border, semibold
- Icon-only: p-2, rounded-lg
- Sizes: Small (px-4 py-2, sm text), Regular (px-6 py-3), Large (px-8 py-4, lg text)

**Badges/Status:**
- Rounded-full, px-3 py-1, xs text, semibold
- Types: Active, Inactive, Pending (different background treatments)

**Modals:**
- Overlay: Fixed, inset-0, backdrop blur
- Content: max-w-2xl, mx-auto, mt-20, rounded-xl, shadow-2xl
- Header: p-6, border-b, flex justify-between (title + close icon)
- Body: p-6
- Footer: p-6, border-t, flex justify-end gap-3

## Key Pages Layout

**Dashboard Home:**
- Stats row (4 cards): Total Members, Active Services, This Week Attendance, Monthly Donations
- Charts row (2 columns): Attendance trend line chart + Member growth bar chart
- Recent activity table below

**Member Management:**
- Top actions bar: Search field (left) + "Add Member" button (right)
- Filter tabs: All Members, Active, Inactive, New This Month
- Members table with pagination
- Click row opens member detail modal

**Attendance Tracking:**
- Service selector dropdown (Sunday Service, Midweek, Prayer Meeting)
- Date picker for session
- Check-in grid: Member cards (grid-cols-4) with photo, name, check-in button
- Real-time count display at top
- Export attendance report button

**Services Management:**
- Calendar view as primary interface
- List of upcoming services with edit/delete actions
- "Schedule Service" button opens form modal
- Service details: Name, date/time, expected attendance, assigned volunteers

**Reports:**
- Filter sidebar (left): Date range, report type, member groups
- Report cards (right): Attendance reports, Financial summaries, Member demographics
- Each card shows preview + "Generate PDF" button
- Charts for visual data representation

## Images
**No hero images** - this is an admin dashboard application focused on data and functionality.

**Member Photos:** 40px circle avatars in tables, 120px square in profile modals
**Service Images:** 200x150px thumbnails for service planning/history
**Placeholder Graphics:** Use illustration icons for empty states (e.g., "No members found" with people icon)

## Animations
**Minimal, functional only:**
- Sidebar menu item hover: 150ms ease transition
- Modal entrance: 200ms fade + slide from top
- Table row hover: Instant background change (no transition)
- Button states: Instant (no animation)
- Loading spinners: Subtle rotation for data fetching only

## Accessibility
- All form inputs have visible labels
- Icon buttons include aria-labels
- Table headers use proper scope
- Focus states visible with 2px outline offset
- Color combinations meet WCAG AA standards
- Keyboard navigation for all interactive elements