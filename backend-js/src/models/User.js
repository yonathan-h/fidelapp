import { DataTypes } from "sequelize";
import { sequelize } from "../database.js";

export const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    hashedPassword: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "hashed_password",
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "email_verified",
    },
    // single-use, expiring tokens for the email-verification and password-reset links --
    // null once used/expired-and-regenerated. plain random strings (not JWTs) since these
    // need to be invalidated by clearing a DB column, which a stateless JWT can't do
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "verification_token",
    },
    verificationTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "verification_token_expires",
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "reset_token",
    },
    resetTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reset_token_expires",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
