const { ObjectId } = require("mongodb");
const { getDb } = require("../config/database");

async function getCategories(req, res) {
  try {
    const db = getDb();
    const categoriesCol = db.collection("categories");

    const categories = await categoriesCol
      .find({ is_active: true })
      .sort({ display_order: 1, category_name: 1 })
      .project({
        category_name: 1,
        description: 1,
        icon_url: 1,
        display_order: 1,
        is_active: 1,
        created_at: 1,
        updated_at: 1,
      })
      .toArray();

    return res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
}

async function getCategory(req, res) {
  try {
    const id = req.params?.id;
    if (!id || !ObjectId.isValid(String(id))) {
      return res.status(400).json({ message: "Invalid category id" });
    }

    const db = getDb();
    const categoriesCol = db.collection("categories");

    const category = await categoriesCol.findOne(
      { _id: new ObjectId(String(id)) },
      {
        projection: {
          category_name: 1,
          description: 1,
          icon_url: 1,
          display_order: 1,
          is_active: 1,
          created_at: 1,
          updated_at: 1,
        },
      }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({ message: "Failed to fetch category" });
  }
}

module.exports = { getCategories, getCategory };

