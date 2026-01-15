from neo4j_db import driver

def search_cars(
        car_type=None,
        fuel=None,
        gearbox=None,
        city=None,
        price_max=None
):
    query = """
    MATCH (c:Car)
    OPTIONAL MATCH (c)-[:HAS_TYPE]->(t:Type)
    OPTIONAL MATCH (c)-[:HAS_FUEL]->(f:Fuel)
    OPTIONAL MATCH (c)-[:HAS_GEARBOX]->(g:Gearbox)
    OPTIONAL MATCH (c)-[:LOCATED_IN]->(ci:City)
    WHERE
        ($type IS NULL OR t.name = $type) AND
        ($fuel IS NULL OR f.name = $fuel) AND
        ($gearbox IS NULL OR g.name = $gearbox) AND
        ($city IS NULL OR ci.name = $city) AND
        ($price_max IS NULL OR c.price <= $price_max)
    RETURN c, t.name AS type, f.name AS fuel, g.name AS gearbox, ci.name AS city
    """

    with driver.session() as session:
        result = session.run(
            query,
            type=car_type,
            fuel=fuel,
            gearbox=gearbox,
            city=city,
            price_max=price_max
        )

        return [
            {
                "model": r["c"]["model"],
                "title": r["c"]["title"],
                "price": r["c"]["price"],
                "year": r["c"]["year"],
                "km": r["c"]["km"],
                "image": r["c"]["image"],
                "whatsapp": r["c"]["whatsapp"],
                "type": r["type"],
                "fuel": r["fuel"],
                "gearbox": r["gearbox"],
                "city": r["city"],
            }
            for r in result
        ]
