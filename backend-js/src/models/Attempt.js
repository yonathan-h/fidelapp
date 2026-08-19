import { DataTypes } from "sequelize";
import { sequelize } from "../database.js";
import { User } from "./User.js";

export const Attempt = sequelize.define(
  "Attempt",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: { model: User, key: "id" },
    },
    characterRomanization: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "character_romanization",
    },
    shapeScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: "shape_score",
    },
    strokeOrderScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: "stroke_order_score",
    },
  },
  {
    tableName: "attempts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

User.hasMany(Attempt, { foreignKey: "userId", as: "attempts", onDelete: "CASCADE" });
Attempt.belongsTo(User, { foreignKey: "userId", as: "user" });
