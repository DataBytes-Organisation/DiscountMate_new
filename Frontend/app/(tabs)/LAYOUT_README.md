# Layout Backup & Example

## ⚠️ Important Note

**DO NOT create files with `_layout.*` pattern in the `app` directory** - Expo Router will treat them as layout files and cause routing conflicts!

Backup files have been moved to: `Frontend/backups/layouts/`

## Backup Files Location

All backup files are now safely stored outside the app directory:

- `Frontend/backups/layouts/tabs_layout.backup.tsx` - Original tabs layout backup
- `Frontend/backups/layouts/tabs_layout.current.tsx` - Current layout backup (if exists)
- `Frontend/backups/layouts/root_layout.backup.tsx` - Root layout backup

## Current Layout

The current active layout is `app/(tabs)/_layout.tsx` which uses:
- `<Slot>` component instead of empty `<Tabs>` (cleaner for non-tab navigation)
- Better code organization with clear sections
- Comprehensive comments explaining each part
- Same functionality as original, just cleaner structure

## Key Differences from Original

### Original Layout (in backups folder)
- Uses empty `<Tabs>` component (tabs are hidden anyway)
- More complex structure with fetchProducts function (not used)
- Comments with simulated code

### Current Layout (active)
- Uses `<Slot>` instead of empty Tabs (cleaner for non-tab navigation)
- Better code organization with clear sections
- Comprehensive comments explaining each part
- Removed unused imports and functions

## Restoration Instructions

If you need to restore the original layout from backup:

```bash
# Restore tabs layout
cp Frontend/backups/layouts/tabs_layout.backup.tsx Frontend/app/\(tabs\)/_layout.tsx

# Restore root layout (if needed)
cp Frontend/backups/layouts/root_layout.backup.tsx Frontend/app/_layout.tsx
```

## Safe Testing Instructions

When testing different layouts, **always move files outside the app directory** to avoid conflicts:

1. **Backup current layout:**
   ```bash
   cp app/(tabs)/_layout.tsx backups/layouts/tabs_layout.test.tsx
   ```

2. **Modify the active layout file directly:**
   - Edit `app/(tabs)/_layout.tsx` directly
   - Test your changes

3. **If you need to restore:**
   ```bash
   cp backups/layouts/tabs_layout.test.tsx app/(tabs)/_layout.tsx
   ```

## Notes

- Both layouts provide the same functionality
- All context providers are maintained
- Header, Sidebar, and Chatbot remain in the same positions
- The current layout is cleaner and more maintainable
- **Never create `_layout.*.tsx` files in the app directory** - they will be treated as routes!

