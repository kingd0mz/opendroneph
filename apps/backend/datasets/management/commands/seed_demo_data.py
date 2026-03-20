from datetime import date

from django.contrib.gis.geos import MultiPolygon, Polygon
from django.core.management.base import BaseCommand

from datasets.models import (
    AOI,
    AOIPurpose,
    Dataset,
    DatasetStatus,
    DatasetType,
    LicenseType,
    Mission,
    MissionStatus,
    PlatformType,
    ValidationStatus,
)
from users.models import Organization, User


def square_footprint(lng: float, lat: float, size: float = 0.08) -> MultiPolygon:
    half = size / 2
    polygon = Polygon(
        (
            (lng - half, lat - half),
            (lng + half, lat - half),
            (lng + half, lat + half),
            (lng - half, lat + half),
            (lng - half, lat - half),
        ),
        srid=4326,
    )
    return MultiPolygon(polygon, srid=4326)


class Command(BaseCommand):
    help = "Seed demo missions, jobs, and orthophotos for map visualization."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data before seeding.")

    def handle(self, *args, **options):
        if options["reset"]:
            Dataset.objects.filter(title__startswith="Demo:").delete()
            Mission.objects.filter(title__startswith="Demo:").delete()
            AOI.objects.filter(title__startswith="Demo:").delete()

        moderator, _ = User.objects.get_or_create(
            email="demo-moderator@opendroneph.local",
            defaults={
                "is_staff": True,
                "is_email_verified": True,
            },
        )
        moderator_org, _ = Organization.objects.get_or_create(name="PhilSA", defaults={"created_by": moderator})
        if moderator.organization_id != moderator_org.id:
            moderator.organization = moderator_org
            moderator.save(update_fields=["organization", "updated_at"])
        if not moderator.is_staff:
            moderator.is_staff = True
            moderator.save(update_fields=["is_staff"])
        if not moderator.has_usable_password():
            moderator.set_password("demo12345")
            moderator.save(update_fields=["password"])

        contributors = []
        for index, org_name in enumerate(["PhilSA", "Eastern Visayas State University", "Map Action", "UP Diliman"]):
            user, _ = User.objects.get_or_create(
                email=f"demo-contributor-{index + 1}@opendroneph.local",
                defaults={
                    "is_email_verified": True,
                },
            )
            organization, _ = Organization.objects.get_or_create(name=org_name, defaults={"created_by": user})
            if user.organization_id != organization.id:
                user.organization = organization
                user.save(update_fields=["organization", "updated_at"])
            if not user.has_usable_password():
                user.set_password("demo12345")
                user.save(update_fields=["password"])
            contributors.append(user)

        missions = [
            {
                "title": "Demo: Typhoon Domeng - Tacloban",
                "description": "Current mapping priority for Tacloban storm damage assessment.",
                "event_type": "typhoon",
                "purpose": AOIPurpose.DISASTER,
                "center": (125.0, 11.24),
                "size": 0.9,
                "offsets": [(0.00, 0.00), (0.12, 0.08), (-0.1, 0.05), (0.18, -0.06)],
            },
            {
                "title": "Demo: Mayon Validation - Legazpi",
                "description": "Validation support for volcanic and land-cover mapping near Legazpi.",
                "event_type": "validation",
                "purpose": AOIPurpose.LANDCOVER,
                "center": (123.74, 13.14),
                "size": 0.8,
                "offsets": [(0.00, 0.00), (0.15, -0.04), (-0.14, 0.06)],
            },
        ]

        created_datasets = 0

        for mission_data in missions:
            aoi, _ = AOI.objects.get_or_create(
                title=mission_data["title"],
                defaults={
                    "description": mission_data["description"],
                    "geometry": square_footprint(*mission_data["center"], size=mission_data["size"]),
                    "purpose": mission_data["purpose"],
                    "is_active": True,
                },
            )
            mission, _ = Mission.objects.get_or_create(
                title=mission_data["title"],
                defaults={
                    "description": mission_data["description"],
                    "aoi": aoi,
                    "event_type": mission_data["event_type"],
                    "status": MissionStatus.ACTIVE,
                    "created_by": moderator,
                },
            )

            for index, (lng_offset, lat_offset) in enumerate(mission_data["offsets"]):
                owner = contributors[index % len(contributors)]
                raw_job, created = Dataset.objects.get_or_create(
                    title=f"Demo: RAW Job {index + 1} - {mission.title}",
                    defaults={
                        "description": f"Demo RAW job for {mission.title}.",
                        "uploader": owner,
                        "aoi": aoi,
                        "footprint": square_footprint(mission_data["center"][0] + lng_offset, mission_data["center"][1] + lat_offset, size=0.12),
                        "type": DatasetType.RAW,
                        "status": DatasetStatus.PUBLISHED,
                        "validation_status": ValidationStatus.VALID,
                        "capture_date": date(2026, 3, 1),
                        "platform_type": PlatformType.DRONE,
                        "camera_model": "DJI Mavic 3",
                        "license_type": LicenseType.CC_BY,
                    },
                )
                if created:
                    created_datasets += 1

                if index % 2 == 0:
                    ortho, ortho_created = Dataset.objects.get_or_create(
                        title=f"Demo: Orthophoto {index + 1} - {mission.title}",
                        defaults={
                            "description": f"Demo orthophoto linked to {mission.title}.",
                            "uploader": contributors[(index + 1) % len(contributors)],
                            "aoi": aoi,
                            "job": raw_job,
                            "mission": mission,
                            "footprint": square_footprint(mission_data["center"][0] + lng_offset + 0.02, mission_data["center"][1] + lat_offset + 0.02, size=0.09),
                            "type": DatasetType.ORTHOPHOTO,
                            "status": DatasetStatus.PUBLISHED,
                            "validation_status": ValidationStatus.VALID,
                            "capture_date": date(2026, 3, 2),
                            "platform_type": PlatformType.DRONE,
                            "camera_model": "DJI Mavic 3",
                            "license_type": LicenseType.CC_BY,
                        },
                    )
                    if ortho_created:
                        created_datasets += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo data ready. Created/confirmed {len(missions)} missions and added {created_datasets} datasets."
            )
        )
