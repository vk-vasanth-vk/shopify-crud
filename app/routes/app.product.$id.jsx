import React, { useState } from "react";
import { Form, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import shopify from "/home/vasanthakumar/Shopify-CRUD/crud-app/app/shopify.server.js";
import {
  Page,
  Card,
  TextField,
  Button,
  FormLayout,
  Banner,
} from "@shopify/polaris";

// --- LOADER: Fetch product if editing, else return defaults ---
export const loader = async ({ params, request }) => {
  const { id } = params;
  if (!id || id === "new") {
    // New product: return defaults
    return json({
      product: {
        id: "",
        title: "",
        descriptionHtml: "",
        variants: { edges: [{ node: { price: "", inventoryItem: { id: "", inventoryLevels: { edges: [] } } } }] },
      },
      quantity: "",
    });
  }

  // Editing: fetch product by ID, including inventory quantity
  const { admin } = await shopify.authenticate.admin(request);
  const productId = id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
  const response = await admin.graphql(
    `
    query ($id: ID!) {
      product(id: $id) {
        id
        title
        descriptionHtml
        variants(first: 1) {
          edges {
            node {
              id
              price
              inventoryItem {
                id
                tracked
                inventoryLevels(first: 10) {
                  edges {
                    node {
                      quantities(names: ["on_hand"]) {
                        name
                        quantity
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    `,
    { variables: { id: productId } }
  );
  const data = await response.json();

  // Calculate total quantity across all locations
  const variant = data.data.product.variants.edges[0]?.node;
  const inventoryLevels = variant?.inventoryItem?.inventoryLevels?.edges || [];
  let quantity = "";
  for (const level of inventoryLevels) {
    const onHand = level.node.quantities.find(q => q.name === "on_hand");
    quantity = (parseInt(quantity, 10) || 0) + (onHand?.quantity ?? 0);
  }

  return json({ product: data.data.product, quantity: quantity.toString() });
};

// --- ACTION: Create or Update product ---
export const action = async ({ request }) => {
  const formData = await request.formData();
  const productId = formData.get("productId");
  const title = formData.get("title");
  const descriptionHtml = formData.get("descriptionHtml");
  const price = formData.get("price");
  const quantity = parseInt(formData.get("quantity"), 10);

  if (!title || !price || isNaN(quantity)) {
    return json({ error: "Title, price, and quantity are required." });
  }

  const { admin } = await shopify.authenticate.admin(request);

  let variantId, inventoryItemId, productGid;

  // --- UPDATE PRODUCT ---
  if (productId) {
    // 1. Update product details
    const productUpdateMutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            variants(first: 1) {
              edges {
                node {
                  id
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const productUpdateVariables = {
      input: {
        id: productId,
        title,
        descriptionHtml,
      },
    };
    const productUpdateResponse = await admin.graphql(productUpdateMutation, { variables: productUpdateVariables });
    const productUpdateData = await productUpdateResponse.json();

    if (
      productUpdateData.errors ||
      productUpdateData.data.productUpdate.userErrors.length
    ) {
      return json({
        error:
          productUpdateData.errors?.[0]?.message ||
          productUpdateData.data.productUpdate.userErrors[0].message,
      });
    }

    productGid = productUpdateData.data.productUpdate.product.id;
    variantId = productUpdateData.data.productUpdate.product.variants.edges[0].node.id;
    inventoryItemId = productUpdateData.data.productUpdate.product.variants.edges[0].node.inventoryItem.id;
  } else {
    // 1. CREATE PRODUCT
    const productCreateMutation = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            variants(first: 1) {
              edges {
                node {
                  id
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const productCreateVariables = {
      input: {
        title,
        descriptionHtml,
      },
    };
    const productCreateResponse = await admin.graphql(productCreateMutation, { variables: productCreateVariables });
    const productCreateData = await productCreateResponse.json();

    if (
      productCreateData.errors ||
      productCreateData.data.productCreate.userErrors.length
    ) {
      return json({
        error:
          productCreateData.errors?.[0]?.message ||
          productCreateData.data.productCreate.userErrors[0].message,
      });
    }

    productGid = productCreateData.data.productCreate.product.id;
    variantId = productCreateData.data.productCreate.product.variants.edges[0].node.id;
    inventoryItemId = productCreateData.data.productCreate.product.variants.edges[0].node.inventoryItem.id;
  }

  // 2. Update variant price
  const variantUpdateMutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variantUpdateVariables = {
    productId: productGid,
    variants: [
      {
        id: variantId,
        price,
      },
    ],
  };
  const variantUpdateResponse = await admin.graphql(variantUpdateMutation, { variables: variantUpdateVariables });
  const variantUpdateData = await variantUpdateResponse.json();

  if (
    variantUpdateData.errors ||
    variantUpdateData.data.productVariantsBulkUpdate.userErrors.length
  ) {
    return json({
      error:
        variantUpdateData.errors?.[0]?.message ||
        variantUpdateData.data.productVariantsBulkUpdate.userErrors[0].message,
    });
  }

  // 3. Get locationId for inventory adjustment
  const locationRes = await admin.graphql(`
    query {
      locations(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
  `);
  const locationData = await locationRes.json();
  const locationId = locationData.data.locations.edges[0].node.id;

  // 4. Enable inventory tracking for the inventory item (latest syntax)
  const enableTrackingMutation = `
    mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem {
          id
          tracked
        }
        userErrors {
          message
        }
      }
    }
  `;

  const enableTrackingVariables = {
    id: inventoryItemId,
    input: {
      tracked: true,
    },
  };

  const trackingResponse = await admin.graphql(enableTrackingMutation, { variables: enableTrackingVariables });
  const trackingData = await trackingResponse.json();

  if (
    trackingData.errors ||
    (trackingData.data.inventoryItemUpdate && trackingData.data.inventoryItemUpdate.userErrors.length)
  ) {
    return json({
      error:
        trackingData.errors?.[0]?.message ||
        trackingData.data.inventoryItemUpdate.userErrors[0].message,
    });
  }

  // 5. Set the actual quantity using inventorySetQuantities (the correct way!)
  const setQuantitiesMutation = `
    mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) {
        inventoryAdjustmentGroup {
          createdAt
          reason
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const setQuantitiesVariables = {
    input: {
      name: "on_hand",
      reason: "correction",
      ignoreCompareQuantity: true,
      quantities: [
        {
          inventoryItemId,
          locationId,
          quantity,
        }
      ]
    }
  };
  const setQuantitiesResponse = await admin.graphql(setQuantitiesMutation, { variables: setQuantitiesVariables });
  const setQuantitiesData = await setQuantitiesResponse.json();

  if (
    setQuantitiesData.errors ||
    (setQuantitiesData.data.inventorySetQuantities && setQuantitiesData.data.inventorySetQuantities.userErrors.length)
  ) {
    return json({
      error:
        setQuantitiesData.errors?.[0]?.message ||
        setQuantitiesData.data.inventorySetQuantities.userErrors[0].message,
    });
  }

  // Success!
  return redirect("/app");
};

// --- FORM COMPONENT ---
export default function ProductForm() {
  const { product, quantity: loaderQuantity } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  // Pre-fill state from loader
  const [title, setTitle] = useState(product.title || "");
  const [descriptionHtml, setDescriptionHtml] = useState(product.descriptionHtml || "");
  const [price, setPrice] = useState(product.variants.edges[0]?.node.price || "");
  const [quantity, setQuantity] = useState(loaderQuantity || "");

  const isEditing = Boolean(product.id);

  return (
    <Page title={isEditing ? "Edit Product" : "Create Product"}>
      <Card sectioned>
        <Form method="post">
          <input type="hidden" name="productId" value={product.id || ""} />
          <FormLayout>
            {actionData?.error && (
              <Banner status="critical">{actionData.error}</Banner>
            )}
            <TextField
              label="Title"
              name="title"
              value={title}
              onChange={setTitle}
              autoComplete="off"
              required
            />
            <TextField
              label="Description"
              name="descriptionHtml"
              value={descriptionHtml}
              onChange={setDescriptionHtml}
              multiline={4}
            />
            <TextField
              label="Price"
              name="price"
              value={price}
              onChange={setPrice}
              type="number"
              required
            />
            <TextField
              label="Quantity"
              name="quantity"
              value={quantity}
              onChange={setQuantity}
              type="number"
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                primary
                submit
                loading={navigation.state === "submitting"}
              >
                {isEditing ? "Update Product" : "Create Product"}
              </Button>
            </div>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}
