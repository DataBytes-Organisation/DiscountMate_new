import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

type Props = {
  productId: string | number;
  /** ✅ optional for Coles rows where code is the stable key */
  productCode?: string | number;
  name: string;
  price: number | string;
  image?: string;
  shortDescription?: string;
  quantity: number;
  basketItemId?: number;
  addToBasket: (idOrCode: string | number) => void;
  removeFromBasket: (idOrCode: string | number) => void;
  deleteItemFromBasket: (idOrCode: string | number) => void;
};

export default function BasketSummaryItem(props: Props) {
  const {
    productId,
    productCode,          //  NEW
    name,
    price,
    image,
    shortDescription,
    quantity,
    addToBasket,
    removeFromBasket,
    deleteItemFromBasket,
  } = props;

  const numericPrice =
    typeof price === 'number' ? price : Number(price || 0);

  // ✅ Use a single stable key across both DBs
  const idOrCode = (productId ?? productCode) as string | number;
  const canDecrement = (Number(quantity || 0) > 1);

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: image || '' }}
        style={styles.image}
        resizeMode="cover"
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name || 'Unnamed Product'}
        </Text>

        {!!shortDescription && (
          <Text style={styles.desc} numberOfLines={2}>
            {shortDescription}
          </Text>
        )}

        <Text style={styles.price}>${numericPrice.toFixed(2)}</Text>

        <View style={styles.row}>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => canDecrement && removeFromBasket(idOrCode)}
              disabled={!canDecrement}
              style={[
                styles.stepBtn,
                styles.stepBtnLeft,
                !canDecrement && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
            >
              <Text style={styles.stepIcon}>−</Text>
            </TouchableOpacity>

            <Text style={styles.qty}>{quantity ?? 1}</Text>

            <TouchableOpacity
              onPress={() => addToBasket(idOrCode)}
              style={[styles.stepBtn, styles.stepBtnRight]}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
            >
              <Text style={styles.stepIcon}>＋</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => deleteItemFromBasket(idOrCode)}
            style={styles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove item"
          >
            <Text style={styles.removeIcon}>🗑️</Text>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** Keep these aligned with your Category card tokens */
const COLORS = {
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  subtext: '#6B7280',
  price: '#10B981',      // emerald/teal like Categories
  stepBg: '#F3F4F6',
  danger: '#EF4444',
  removeBg: '#FFF1F2',
  removeBorder: '#FEE2E2',
  shadow: 'rgba(17, 24, 39, 0.06)',
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 12,
    ...(Platform.select({
      ios: {
        shadowColor: COLORS.shadow,
        shadowOpacity: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }) as object),
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  info: {
    flex: 1,
    minHeight: 76,
  },
  name: {
    fontSize: 15.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  desc: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.subtext,
  },
  price: {
    marginTop: 6,
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.price,
  },
  row: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.stepBg,
  },
  stepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  stepBtnRight: {
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
  },
  stepIcon: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 12,
  },
  qty: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  removeBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.removeBg,
    borderWidth: 1,
    borderColor: COLORS.removeBorder,
  },
  removeIcon: {
    fontSize: 14,
  },
  removeText: {
    color: COLORS.danger,
    fontSize: 13.5,
    fontWeight: '700',
  },
});
