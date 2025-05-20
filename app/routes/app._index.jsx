import React, { useEffect } from "react";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import shopify from "/home/vasanthakumar/Shopify-CRUD/crud-app/app/shopify.server.js";
import {
  Button,
  IndexTable,
  LegacyCard,
  Text,
  Page,
} from "@shopify/polaris";
import { EditIcon, DeleteIcon } from "@shopify/polaris-icons";

// Loader: Fetch products with inventory data (sum quantity across all locations)
export const loader = async ({ request }) => {
  const { admin } = await shopify.authenticate.admin(request);

  // Fetch products, variants, and inventory data for all locations
  const response = await admin.graphql(`
    {
      products(first: 50) {
        edges {
          node {
            id
            title
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  inventoryItem {
                    id
                    inventoryLevels(first: 20) {
                      edges {
                        node {
                          quantities(names: ["on_hand", "available"]) {
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
      }
    }
  `);

  const data = await response.json();

  // Map products and sum the available quantity for all locations
  const products = data.data.products.edges.map(edge => {
    const variant = edge.node.variants.edges[0]?.node;
    const inventoryLevels = variant?.inventoryItem?.inventoryLevels?.edges || [];
    let quantity = 0;
    for (const level of inventoryLevels) {
      const onHand = level.node.quantities.find(q => q.name === "on_hand");
      const available = level.node.quantities.find(q => q.name === "available");
      quantity += onHand?.quantity ?? available?.quantity ?? 0;
    }
    return {
      id: edge.node.id,
      title: edge.node.title,
      price: variant?.price ?? "",
      quantity, // Only total quantity
    };
  });

  return json({ products });
};

// Action: Delete product
export const action = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get("deleteProductId");
  if (!id) return json({ ok: false, error: "No product ID" }, { status: 400 });

  try {
    const { admin } = await shopify.authenticate.admin(request);
    const mutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;
    const variables = { input: { id } };
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    if (
      data.errors ||
      data.data.productDelete.userErrors.length ||
      !data.data.productDelete.deletedProductId
    ) {
      return json({
        ok: false,
        error:
          data.errors?.[0]?.message ||
          data.data.productDelete.userErrors[0]?.message ||
          "Unknown error",
      });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error.message || "Unknown error" });
  }
};

export default function AppIndex() {
  const { products = [] } = useLoaderData() || {};
  const navigate = useNavigate();
  const fetcher = useFetcher();

  // Refresh the page after successful deletion
  useEffect(() => {
    if (fetcher.data?.ok) {
      window.location.reload();
    }
  }, [fetcher.data]);

  const rowMarkup = products.map(
    ({ id, title, price, quantity }, index) => {
      // If id is a GID, extract the numeric part for routing
      const numericId = id.replace("gid://shopify/Product/", "");
      return (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {title}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text>
              {price}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span" numeric>
              {quantity}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button
                icon={EditIcon}
                accessibilityLabel="Edit"
                onClick={() => navigate(`/app/product/${numericId}`)}
                plain
              />
              <Button
                icon={DeleteIcon}
                accessibilityLabel="Delete"
                plain
                destructive
                onClick={async () => {
                  const response = await fetch(`${window.location.pathname}?index`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({ deleteProductId: id }),
                  });
                  const data = await response.json();
                }}
              />
            </div>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Text variant="headingXl" as="h1">
          Shopify Products
        </Text>
        <Button primary onClick={() => navigate("/app/product/new")}>
          Create
        </Button>
      </div>

      <div style={{ maxWidth: "900px", margin: "2rem auto 0 auto" }}>
        <LegacyCard>
          <IndexTable
            selectable={false}
            itemCount={products.length}
            headings={[
              { title: "Title" },
              { title: "Price" },
              { title: "Quantity" },
              { title: "Actions", alignment: "end" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </LegacyCard>
      </div>
    </Page>
  );
}
