# Frontend Layout Structure & Development Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Layout Hierarchy](#layout-hierarchy)
4. [Route Groups Explained](#route-groups-explained)
5. [Standard Operating Procedures](#standard-operating-procedures)
6. [Adding New Pages](#adding-new-pages)
7. [Best Practices](#best-practices)
8. [Examples](#examples)



## Overview

This project uses **Expo Router** with file-based routing. The routing structure follows a hierarchical layout system where each route group can have its own layout wrapper, allowing for different navigation patterns and UI structures across different sections of the app.

### Key Technologies
- **Expo Router** - File-based routing system
- **React Native** - Mobile framework
- **NativeWind** - Tailwind CSS for React Native
- **TypeScript** - Type safety



## Architecture

### Directory Structure

```
Frontend/
├── app/                          # Main routing directory (Expo Router)
│   ├── _layout.tsx              # Root layout (Stack navigator)
│   ├── +not-found.tsx           # 404 page
│   ├── +html.tsx                # HTML wrapper for web
│   │
│   ├── (tabs)/                  # Main tab-based navigation group ⭐ ACTIVE
│   │   ├── _layout.tsx          # Tabs layout (Header + CategoryTabs + SearchBar)
│   │   ├── index.tsx            # Home page (landing page)
detail page
│   │   └── category/[id].tsx   # Dynamic category page
│   │
│   ├── (compare)/               # Comparison route group (currently EMPTY)
│   ├── (product)/               # Product route group (currently EMPTY)
│   ├── (profile)/               # Profile route group (currently EMPTY)
│   └── (specials)/              # Specials route group (currently EMPTY)
│
└── components/                  # Reusable components
    ├── layout/                  # Layout components
    │   ├── Header.tsx           # App header
    │   ├── CategoryTabs.tsx     # Category navigation tabs
    │   └── SearchBar.tsx        # Search bar component
    │
    └── home/                    # Home page sections
        ├── HomeMainSection.tsx
        ├── TrendingInsightsSection.tsx
        ├── SavingsSummarySection.tsx
        ├── SmartListsSection.tsx
        ├── PriceAlertsSection.tsx
        ├── ComparisonToolsSection.tsx
        ├── RetailerPerformanceSection.tsx
        ├── WeeklySpecialsSection.tsx
        └── FooterSection.tsx
```



## Layout Hierarchy

### Three-Level Layout System

```
Root Layout (app/_layout.tsx)
    ↓
Route Group Layout (e.g., app/(tabs)/_layout.tsx)
    ↓
Page Component (e.g., app/(tabs)/index.tsx)
```

### 1. Root Layout (`app/_layout.tsx`)

**Purpose**: Top-level layout that wraps the entire application.

**Responsibilities**:
- Theme provider (dark/light mode)
- Font loading
- Splash screen management
- Stack navigator setup
- Registers route groups

**Current Configuration**:
```tsx
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="+not-found" />
</Stack>
```

**⚠️ Important**: Only route groups registered here will be accessible. Currently, only `(tabs)` is active.

### 2. Route Group Layout (`app/(tabs)/_layout.tsx`)

**Purpose**: Defines the layout structure for all pages within the `(tabs)` route group.

**Current Structure**:
```
┌─────────────────────────────────┐
│ AppHeader                       │ ← Top navigation
├─────────────────────────────────┤
│ CategoryTabs                    │ ← Category navigation
├─────────────────────────────────┤
│ SearchBar                       │ ← Search functionality
├─────────────────────────────────┤
│                                 │
│   <Slot />                      │ ← Page content rendered here
│   (Your page component)         │
│                                 │
└─────────────────────────────────┘
```

**Components Used**:
- `AppHeader` - Main app header with logo and navigation
- `CategoryTabs` - Category filtering tabs
- `SearchBar` - Global search bar
- `<Slot />` - Expo Router component that renders child routes

### 3. Page Components

**Purpose**: Individual page content that gets rendered inside the `<Slot />` of the route group layout.

**Example**: `app/(tabs)/index.tsx` (Home page)



## Route Groups Explained

### What are Route Groups?

Route groups in Expo Router are directories wrapped in parentheses `(groupName)`. They:
- **Don't affect the URL** - `(tabs)/index.tsx` routes to `/`, not `/(tabs)/`
- **Allow different layouts** - Each group can have its own `_layout.tsx`
- **Organize related pages** - Group pages that share the same layout/navigation pattern

### Current Route Groups

#### `(tabs)` - **ACTIVE** (Main App Pages)
- **Layout**: Full layout with Header, CategoryTabs, SearchBar
- **Use Case**: Most app pages that need navigation and search
- **Status**: Currently in use
- **Pages**: Home, Search, Profile, Basket, Wishlist, etc.


#### `(compare)`, `(product)`, `(profile)`, `(specials)` - **EMPTY**
- **Status**: Empty directories, ready for future use
- **Purpose**: Reserved for pages that need different layouts



## Standard Operating Procedures

### SOP 1: When to Use Route Groups vs. Keep in `(tabs)`

#### ✅ **Keep in `(tabs)` if:**
- Page needs the standard layout (Header + CategoryTabs + SearchBar)
- Page is part of the main app navigation flow
- Page should be accessible with the same navigation structure

**Examples**: Search, Profile, Basket, Wishlist, Blog, Contact

#### ✅ **Create New Route Group if:**
- Page needs a **different layout** (e.g., no CategoryTabs, different header)
- Page is part of a **distinct feature** that warrants its own navigation pattern
- Page needs **different navigation behavior** (e.g., modal, full-screen)

**Examples**:
- `(product)/[id].tsx` - Product detail might not need CategoryTabs
- `(auth)/login.tsx` - Auth pages might need minimal layout
- `(specials)/index.tsx` - Specials might need special header

### SOP 2: Adding a New Page

#### Option A: Add to Existing `(tabs)` Group

**Steps**:
1. Create file: `app/(tabs)/your-page.tsx`
2. Export default component
3. Page automatically gets `(tabs)` layout (Header, CategoryTabs, SearchBar)
4. Access via route: `/your-page`

**Example**:
```tsx
// app/(tabs)/specials.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function SpecialsPage() {
  return (
    <View>
      <Text>Specials Page</Text>
    </View>
  );
}
```

#### Option B: Create New Route Group

**Steps**:
1. Create directory: `app/(your-group)/`
2. Create `_layout.tsx` with custom layout
3. Create page: `app/(your-group)/index.tsx` or `app/(your-group)/your-page.tsx`
4. Register in `app/_layout.tsx`:
   ```tsx
   <Stack>
     <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
     <Stack.Screen name="(your-group)" options={{ headerShown: false }} />
     <Stack.Screen name="+not-found" />
   </Stack>
   ```

**Example**:
```tsx
// app/(specials)/_layout.tsx
import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import AppHeader from "../../components/layout/Header";

export default function SpecialsLayout() {
  return (
    <View className="flex-1">
      <AppHeader />
      {/* No CategoryTabs for specials */}
      <Slot />
    </View>
  );
}

// app/(specials)/index.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function SpecialsPage() {
  return (
    <View>
      <Text>Specials Page</Text>
    </View>
  );
}
```

### SOP 3: Creating Dynamic Routes

**Pattern**: Use square brackets `[param]` for dynamic segments.

**Examples**:
- `app/(tabs)/product/[id].tsx` → `/product/123`
- `app/(tabs)/category/[id].tsx` → `/category/fruits`

**Accessing Parameters**:
```tsx
import { useLocalSearchParams } from 'expo-router';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Use id in your component
}
```

### SOP 4: Navigation Between Pages

**Using Expo Router**:
```tsx
import { useRouter, useSegments } from 'expo-router';

// Navigate to a page
const router = useRouter();
router.push('/specials');
router.push('/product/123');
router.push('/category/fruits');

// Replace current route
router.replace('/login');

// Go back
router.back();
```



## Adding New Pages

### Quick Reference Checklist

- [ ] Decide: Does this page need the standard layout?
  - **Yes** → Add to `(tabs)`
  - **No** → Create new route group
- [ ] Create the page file in appropriate location
- [ ] If new route group: Create `_layout.tsx` and register in root layout
- [ ] Test navigation to the new page
- [ ] Update navigation links/buttons if needed

### Step-by-Step: Adding a Specials Page to `(tabs)`

1. **Create the file**:
   ```bash
   touch app/(tabs)/specials.tsx
   ```

2. **Write the component**:
   ```tsx
   // app/(tabs)/specials.tsx
   import React from 'react';
   import { View, Text, StyleSheet } from 'react-native';

   export default function SpecialsPage() {
     return (
       <View style={styles.container}>
         <Text style={styles.title}>Weekly Specials</Text>
         {/* Your content here */}
       </View>
     );
   }

   const styles = StyleSheet.create({
     container: {
       flex: 1,
       padding: 16,
     },
     title: {
       fontSize: 24,
       fontWeight: 'bold',
     },
   });
   ```

3. **Navigate to it** (from anywhere in the app):
   ```tsx
   import { useRouter } from 'expo-router';

   const router = useRouter();
   router.push('/specials');
   ```

4. **Done!** The page will automatically use the `(tabs)` layout.

### Step-by-Step: Creating a New Route Group

1. **Create directory structure**:
   ```bash
   mkdir -p app/(specials)
   ```

2. **Create layout file**:
   ```tsx
   // app/(specials)/_layout.tsx
   import React from "react";
   import { View, ScrollView } from "react-native";
   import { Slot } from "expo-router";
   import AppHeader from "../../components/layout/Header";
   // Note: No CategoryTabs or SearchBar if not needed

   export default function SpecialsLayout() {
     return (
       <View className="flex-1 bg-[#F3F4F6]">
         <AppHeader />
         <ScrollView className="flex-1">
           <Slot />
         </ScrollView>
       </View>
     );
   }
   ```

3. **Create page file**:
   ```tsx
   // app/(specials)/index.tsx
   import React from 'react';
   import { View, Text } from 'react-native';

   export default function SpecialsPage() {
     return (
       <View>
         <Text>Specials</Text>
       </View>
     );
   }
   ```

4. **Register in root layout**:
   ```tsx
   // app/_layout.tsx
   <Stack>
     <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
     <Stack.Screen name="(specials)" options={{ headerShown: false }} />
     <Stack.Screen name="+not-found" />
   </Stack>
   ```

5. **Access via route**: `/specials` (or `/` if it's `index.tsx`)



## Best Practices

### ✅ DO

1. **Keep related pages together** - Group pages that share functionality
2. **Use route groups for different layouts** - Don't create groups just for organization
3. **Follow naming conventions**:
   - Route groups: `(lowercase-with-dashes)`
   - Pages: `kebab-case.tsx` or `camelCase.tsx`
   - Dynamic routes: `[param].tsx`
4. **Reuse layout components** - Import from `components/layout/`
5. **Use TypeScript** - Type your components and props
6. **Test navigation** - Ensure routes work as expected

### ❌ DON'T

1. **Don't create `_layout.*` files outside route groups** - They become routes!
2. **Don't nest route groups** - `(tabs)/(product)` is not recommended
3. **Don't duplicate layouts** - Reuse components from `components/layout/`
4. **Don't forget to register new route groups** - Add to `app/_layout.tsx`
5. **Don't use route groups just for organization** - Use them for different layouts

### File Naming Rules

- **Layout files**: `_layout.tsx` (must start with underscore)
- **404 page**: `+not-found.tsx` (must start with plus)
- **HTML wrapper**: `+html.tsx` (must start with plus)
- **Regular pages**: `page-name.tsx` or `PageName.tsx`
- **Dynamic routes**: `[param].tsx`



## Examples

### Example 1: Simple Page in `(tabs)`

```tsx
// app/(tabs)/about.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AboutPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About DiscountMate</Text>
      <Text>Your content here...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
```

**Route**: `/about`
**Layout**: Uses `(tabs)/_layout.tsx` (Header + CategoryTabs + SearchBar)

### Example 2: Dynamic Route

```tsx
// app/(tabs)/product/[id].tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ProductDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    // Fetch product by id
    fetchProduct(id).then(setProduct);
  }, [id]);

  return (
    <View>
      <Text>Product ID: {id}</Text>
      {/* Product details */}
    </View>
  );
}
```

**Route**: `/product/123` (where 123 is the product ID)

### Example 3: New Route Group with Custom Layout

```tsx
// app/(auth)/_layout.tsx
import React from "react";
import { View } from "react-native";
import { Slot } from "expo-router";

export default function AuthLayout() {
  return (
    <View className="flex-1 bg-white">
      {/* Minimal layout for auth pages */}
      <Slot />
    </View>
  );
}

// app/(auth)/login.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function LoginPage() {
  return (
    <View>
      <Text>Login</Text>
    </View>
  );
}
```

**Route**: `/login`
**Layout**: Uses `(auth)/_layout.tsx` (minimal, no Header/Tabs)



## Troubleshooting

### Page Not Showing?

1. **Check file location** - Is it in the correct route group?
2. **Check root layout** - Is the route group registered in `app/_layout.tsx`?
3. **Check file name** - Does it follow naming conventions?
4. **Check exports** - Is there a default export?

### Layout Not Applying?

1. **Check `_layout.tsx`** - Does it exist in the route group?
2. **Check `<Slot />`** - Is it included in the layout?
3. **Check imports** - Are layout components imported correctly?

### Navigation Not Working?

1. **Check route path** - Use exact path (e.g., `/specials`, not `/specials/`)
2. **Check route group** - Ensure you're navigating to the correct group
3. **Check router import** - `import { useRouter } from 'expo-router'`


## Quick Reference

### Current Active Structure

```
✅ ACTIVE:
- app/(tabs)/* - All main app pages

⚠️ UNUSED/EMPTY:
- app/(compare)/ - Empty, ready for use
- app/(product)/ - Empty, ready for use
- app/(profile)/ - Empty, ready for use
- app/(specials)/ - Empty, ready for use
```

### Layout Components Location

```
components/layout/
├── Header.tsx        # Main app header
├── CategoryTabs.tsx # Category navigation
└── SearchBar.tsx    # Search functionality
```

### Common Routes

- `/` - Home page (`(tabs)/index.tsx`)




## Additional Resources

- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [File-based Routing Guide](https://docs.expo.dev/router/file-based-routing/)
- [Layouts in Expo Router](https://docs.expo.dev/router/advanced/layouts/)



## Questions or Issues?

If you encounter issues or have questions about the layout structure:
1. Check this guide first
2. Review existing pages for examples
3. Consult Expo Router documentation
4. Ask the team lead or senior developer



**Last Updated**: 12/04/2025
**Maintained By**: Development Team
**Version**: 1.0
