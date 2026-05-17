#!/bin/sh

set -eu

usage() {
    cat <<'EOF'
Usage: rename_csv_filenames.sh apply|revert

Renames CSV files anywhere under the script's directory.
EOF
}

if [ "$#" -ne 1 ]; then
    usage >&2
    exit 1
fi

command=$1
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

rename_prefix_apply() {
    case $1 in
        aldi_products_*) printf '%s\n' "${1#aldi_products_}" | sed 's/^/aldi_all_products_/' ;;
        iga_products_*) printf '%s\n' "${1#iga_products_}" | sed 's/^/iga_all_products_/' ;;
        coles_products_*) printf '%s\n' "${1#coles_products_}" | sed 's/^/coles_brands_/' ;;
        ww_products_*) printf '%s\n' "${1#ww_products_}" | sed 's/^/woolworths_brands_/' ;;
        *) return 1 ;;
    esac
}

rename_prefix_revert() {
    case $1 in
        aldi_all_products_*) printf '%s\n' "${1#aldi_all_products_}" | sed 's/^/aldi_products_/' ;;
        iga_all_products_*) printf '%s\n' "${1#iga_all_products_}" | sed 's/^/iga_products_/' ;;
        coles_brands_*) printf '%s\n' "${1#coles_brands_}" | sed 's/^/coles_products_/' ;;
        woolworths_brands_*) printf '%s\n' "${1#woolworths_brands_}" | sed 's/^/ww_products_/' ;;
        *) return 1 ;;
    esac
}

rename_timestamp_apply() {
    printf '%s\n' "$1" | sed -E 's/_([0-9]{8})T([0-9]{6})Z\.csv$/_\1_\2.csv/'
}

rename_timestamp_revert() {
    printf '%s\n' "$1" | sed -E 's/_([0-9]{8})_([0-9]{6})\.csv$/_\1T\2Z.csv/'
}

rename_file() {
    source_path=$1
    destination_path=$2

    if [ "$source_path" = "$destination_path" ]; then
        printf 'skip: %s\n' "$(basename -- "$source_path")"
        return 0
    fi

    if [ -e "$destination_path" ]; then
        printf 'error: destination exists: %s\n' "$destination_path" >&2
        return 1
    fi

    mv -- "$source_path" "$destination_path"
    printf 'renamed: %s -> %s\n' \
        "$(basename -- "$source_path")" \
        "$(basename -- "$destination_path")"
}

apply_mode() {
    status=0
    found_csv=0
    csv_list=$(mktemp)
    find "$script_dir" -type f -name '*.csv' | sort > "$csv_list"
    while IFS= read -r source_path; do
        found_csv=1
        file_name=$(basename -- "$source_path")
        parent_dir=$(dirname -- "$source_path")
        if ! renamed_prefix=$(rename_prefix_apply "$file_name"); then
            printf 'skip: %s\n' "$source_path"
            continue
        fi

        renamed_file=$(rename_timestamp_apply "$renamed_prefix")
        if [ "$renamed_file" = "$renamed_prefix" ]; then
            printf 'skip: %s\n' "$source_path"
            continue
        fi

        if ! rename_file "$source_path" "$parent_dir/$renamed_file"; then
            status=1
        fi
    done < "$csv_list"
    rm -f -- "$csv_list"

    if [ "$found_csv" -eq 0 ]; then
        printf 'no csv files found in %s\n' "$script_dir"
    fi

    return "$status"
}

revert_mode() {
    status=0
    found_csv=0
    csv_list=$(mktemp)
    find "$script_dir" -type f -name '*.csv' | sort > "$csv_list"
    while IFS= read -r source_path; do
        found_csv=1
        file_name=$(basename -- "$source_path")
        parent_dir=$(dirname -- "$source_path")
        if ! renamed_prefix=$(rename_prefix_revert "$file_name"); then
            printf 'skip: %s\n' "$source_path"
            continue
        fi

        renamed_file=$(rename_timestamp_revert "$renamed_prefix")
        if [ "$renamed_file" = "$renamed_prefix" ]; then
            printf 'skip: %s\n' "$source_path"
            continue
        fi

        if ! rename_file "$source_path" "$parent_dir/$renamed_file"; then
            status=1
        fi
    done < "$csv_list"
    rm -f -- "$csv_list"

    if [ "$found_csv" -eq 0 ]; then
        printf 'no csv files found in %s\n' "$script_dir"
    fi

    return "$status"
}

case $command in
    apply)
        apply_mode
        ;;
    revert)
        revert_mode
        ;;
    *)
        usage >&2
        exit 1
        ;;
esac
